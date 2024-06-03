import { load } from "cheerio";
import request from "request";
import path from "path";
import { Builder } from 'selenium-webdriver';


export class Crawler {


  constructor(urlFilters = {}) {
    this.urlFilters = urlFilters;
  }

/**
 * 
 * @param {*} browserName - desired browser (chrome, firefox, edge)
 */
  async initBrowser(browserName){
    const browser = await new Builder()
    .forBrowser(browserName) 
    .build();
    return browser;
  }

  async crawlUrl(url, browser) {
    let done = false;
    let response = await request(url);
     if(browser)  {
      if(typeof browser === 'string') {
        browser = await initBrowser(browser);
      }
      if( browser instanceof Object ) {
        await browser.get(url);
        response = {
          headers: response.headers,
          body:await driver.getPageSource(),
        };

      }
    }

   
    for (const key in this.urlFilters) {
      if (key && this.urlFilters[key]?.analyzeUrl) {
        done =
          (await this.urlFilters[key].analyzeUrl(url)) &&
          this.urlFilters[key]?.final;
        if (done) break;
      }
    }
    if (!done) {
      let extension = path.extname(url.split("?", 1)).replace(".", "");
      const contentType = response.headers["content-type"];
      if (contentType) {
        extension = contentType.split("/")[1];
      }
      extension = extension.toUpperCase();
      if (this["crawl" + extension]) {
        this["crawl" + extension](url);
      } else {
        console.log(`No crawler for extension ${extension}`);
      }
    }
  }

  // HTML / XML logic

  /**
   *
   * @param {*} url - the url of the current page
   * @param {*} response - the response of the current request
   */
  async crawlHTML(url, response) {
    const $ = load(response.body);
    const root = $(":root");
    analyzeMLElement(url, $, root);
    const srcElement = $("[src]");
    analyzeLinkerTags(srcElement, attributeName);
    const hrefElement = $("[href]");
    analyzeLinkerTags(hrefElement, attributeName);

    const sitemapLink = $('link[rel="sitemap"]').attr("href");
    if (sitemapLink) {
      const sitemapUrl = new URL(sitemapLink, url).toString();
      await this.crawlUrl(sitemapUrl);
    }
  }

  async analyzeLinkerTags(collection, attributeName) {
    for (let i = 0; i < collection.length; i++) {
      const link = collection[i];
      const href = $(link).attr(attributeName);
      if (href) {
        const absoluteUrl = new URL(href, url).toString();
        console.log(`Found link:${absoluteUrl}`);
        await this.crawlUrl(absoluteUrl);
      }
    }
  }

  async analyzeMLElement(url, $, element) {
    let done = false;
    for (const key in this.urlFilters[url].selectors) {
      if (
        $(key).filter((x) => x === element).length &&
        this.urlFilters[url].selectors[key]?.analyzeMLElement
      ) {
        done =
          (await this.urlFilters[url].selectors[key].analyzeMLElement(
            element
          )) && this.urlFilters[url].selectors[key]?.final;
      }
      let analyzeMLElementChild = this.analyzeMLElementChild;
      if (
        typeof this.urlFilters[url].selectors[key]?.analyzeMLElementChildren ===
        "function"
      )
        analyzeMLElementChild =
          this.urlFilters[url].selectors[key].analyzeMLElementChild;
      if (this.urlFilters[url].selectors[key]?.analyzeMLElementChildren) {
        await analyzeMLElementChild(url, $, element);
      }
      if (done) break;
    }
    if (!done) {
      const tagName = element.name.toUpperCase();
      if (this["analyze" + tagName]) {
        this["analyze" + tagName](element);
      }
    }
  }

  // CSS logic

  async crawlCSS(url, response) {
    const parsedCSS = cssSelect.parse(response.body);
    const cssRules = cssFilter.traverse(parsedCSS, { filter: "rule" });
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

