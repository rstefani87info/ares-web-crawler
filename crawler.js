import request from "request";
import path from "path";
import axios from "axios";
import { Builder, By, Key, until } from "selenium-webdriver";
import { parseUrl, parseCode } from "@ares/web-ui/ml.js";
import {findPropValueByAlias} from '@ares/core/objects.js'
// import {cssSelect, cssFilter} from 'css-select';


class Crawler {
  constructor(urlFilters = {}) {
    this.urlFilters = urlFilters;
    this.urlMap = {};
  }

  async getUrlTypeFromResponse( 
    url, 
    method = "GET",
    headers = {},
    payload = {} ){

      method=method.toLowerCase();
      if(method==="get"){
        url = url + (url.includes("?") ? "&" : "?") + new URLSearchParams(payload).toString();
      }
      const params =[url,{ headers: headers }]
      if(method!=="get") params[1].data = payload;
      
      try {
        let response = await axios[method](...params); 
        let extension = path.extname(url.split("?", 1)[0]).replace(".", "");
        const contentType = response
          ? response.headers["content-type"] ?? "text/html"
          : "text/html";
        extension = contentType.split("/")[1];
        extension = extension.toUpperCase();
        return extension;
      } catch (error) {
        // Handle error with configurable callback if available
        const urlFilter = findPropValueByAlias(this.urlFilters, url);
        if (urlFilter?.onError) {
          return await urlFilter.onError(url, error, this);
        }
        
        // Default error handling
        if (error.response) {
          console.error(`Error fetching ${url}: ${error.response.status} ${error.response.statusText}`);
          if (error.response.status === 404) {
            console.error(`URL not found: ${url}`);
            this.urlMap[url] = 'NOT_FOUND';
            return null;
          }
        } else {
          console.error(`Error fetching ${url}: ${error.message}`);
        }
        throw error;
      }
  }

  async crawlUrl(url) {
    let ret=null;
    let urlFilter = findPropValueByAlias(this.urlFilters, url);
    if (!this.urlMap[url] && urlFilter) {
      
      const method = (urlFilter?.method) ?? "GET";
      const headers= (urlFilter?.headers) ?? {};  
      const payload= (urlFilter?.payload) ?? {};
      const onload= (urlFilter?.onload) ?? null; 
      const options= (urlFilter?.options) ?? {};
       
      try {
        const extension = await this.getUrlTypeFromResponse(url, method, headers, payload);
        
        // If extension is null, it means there was an error (like 404)
        if (extension === null) {
          console.log(`Skipping URL due to error: ${url}`);
          return null;
        }

        if (this["crawl" + extension]) {
          ret = await this["crawl" + extension](url, method, headers, payload, onload, options, urlFilter);
        } else {
          console.log(`No crawler for extension ${extension}`);
          // Call onUnsupportedExtension callback if available
          if (urlFilter?.onUnsupportedExtension) {
            await urlFilter.onUnsupportedExtension(url, extension, this);
          }
        }
        this.urlMap[url] = true;
      } catch (error) {
        console.error(`Failed to crawl ${url}: ${error.message}`);
        // Mark this URL as visited to prevent retrying
        this.urlMap[url] = 'ERROR';
        
        // Call onCrawlError callback if available
        if (urlFilter?.onCrawlError) {
          await urlFilter.onCrawlError(url, error, this);
        }
      }
    }
    return ret;
  }

  // HTML / XML logic

  /**
   *
   * @param {*} url - the url of the current page
   */
  async crawlHTML(
    url, 
    method = "GET",
    headers = {},
    payload = {},
    onload = null,
    options = {userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36", runScript: "dangerously"},
    urlFilter = null
  ) {
    let ret = null;
     const jdom = await parseUrl(
        url,
        method ,
        headers,
        payload,
        onload,
        options
     );
    const $ = jdom.window.aReS.$;
    const root = jdom.window.aReS.$("*:nth-child(1)")[0];
    if(urlFilter?.analyzeMLElement) ret = await urlFilter.analyzeMLElement(url, $, root);
    else ret = await this.analyzeMLElement(url, $, root, urlFilter);
    if(!urlFilter?.excludeCalledResources){
      const srcElement = $("[src]");
      this.analyzeLinkerTags(url, srcElement, $, "src");
      const hrefElement = $("[href]");
      this.analyzeLinkerTags(url, hrefElement, $, "href");
      const sitemapLink = $('link[rel="sitemap"]').attr("href");
      if (sitemapLink) {
        const sitemapUrl = new URL(sitemapLink, url).toString();
        await this.crawlUrl(sitemapUrl);
      }
    }
    return ret;
  }

  async analyzeLinkerTags(url, collection, $, attributeName) {
    for (let i = 0; i < collection.length; i++) {
      const link = collection[i];
      const href = $(link).attr(attributeName);
      if (href.startsWith("javascript:")) {
      } else if (href.startsWith("mailto:")) {
      } else if (href.startsWith("tel:")) {
      } else if (href.startsWith("#")) {
        const absoluteUrl = new URL(href, url).toString();
        console.log(`Found link:${absoluteUrl}`);
        await this.crawlUrl(absoluteUrl);
      } else if (href) {
        const absoluteUrl = new URL(href, url).toString();
        console.log(`Found link:${absoluteUrl}`);
        await this.crawlUrl(absoluteUrl);
      }
    }
  }

  async analyzeMLElement(url, $, element, urlFilter = null) {
    let done = false;
    const elementHash = element.outerHTML;
    for (const key in ((urlFilter?.selectors) ?? [])) {
      const selectedList = $(key);
      const selected = selectedList.filter(
        (x) => selectedList[x].outerHTML === elementHash
      );
      if (
        selected.length &&
        await urlFilter.selectors[key]?.analyzeMLElement
      ) {
        // done =
          (await urlFilter.selectors[key].analyzeMLElement(
            url,
            $,
            element
          )) && !urlFilter.selectors[key]?.skipChildren;
      }
      if ( urlFilter.selectors[key]?.analyzeMLElementChildren !== false ) {
        await this.analyzeMLElementChild(url, $, element);
      }
      // if (done) break;
    }
    // if (!done) {
    //   const tagName = element.tagName.toUpperCase();
    //   if (this["analyze" + tagName]) {
    //     this["analyze" + tagName](element);
    //   }
    // }
  }

  async analyzeMLElementChild(url, $, element) {
    let textValue = [];
    for (const child of element.childNodes){
      
      if(child.nodeType === 3){
        textValue.push(child.data);
      }else if(child.nodeType === 8) {
        // TODO: analyze comments
      }else if (child.nodeType === 7) {
        // TODO: analyze processing instructions
      }
      else if(child.tagName){
         this.analyzeMLElement(url, $, child);
      }
    }
  }

  // CSS logic

  async crawlCSS(url, response) {
    // const parsedCSS = cssSelect.parse(response.body);
    // const cssRules = cssFilter.traverse(parsedCSS, { filter: "rule" });
    //TODO: implementation of callBack logic for selectors and each property
    //TODO: export property callBack logic to let html node style attribute be analyzed by the same code
    // for (const rule of cssRules) {
    //   const selector = cssSelect.stringify(rule.selector);
    //   const styles = rule.declarations.map(
    //     (declaration) => `${declaration.property}:${declaration.value}`
    //   );
    //   console.log(`Found CSS rule for selector:${selector}`);
    //   console.log(`  Styles:${styles.join(", ")}`);
    // }
  }
}

export const crawler = Crawler;
