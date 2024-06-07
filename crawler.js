import request from "request";
import path from "path";
import { Builder } from "selenium-webdriver";
import { parseUrl } from "@ares/web-ui/ml.js";
// import {cssSelect, cssFilter} from 'css-select';

class Crawler {
  constructor(urlFilters = {}) {
    this.urlFilters = urlFilters;
    this.urlMap = {};
  }

  /**
   *
   * @param {*} browserName - desired browser (chrome, firefox, edge)
   */
  async initBrowser(browserName) {
    const browser = await new Builder().forBrowser(browserName).build();
    return browser;
  }

  async crawlUrl(url, browser) {
    if (!this.urlMap[url]) {
      let done = false;
      let response = null;
      request(url, async (er, res, body) => {
        response = res;
        response = await parseUrl(url);

        if (browser) {
          if (typeof browser === "string") {
            browser = await initBrowser(browser);
          }
          if (browser instanceof Object) {
            await browser.get(url);
            response = {
              headers: response.headers,
              body: await driver.getPageSource(),
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
          let extension = path.extname(url.split("?", 1)[0]).replace(".", "");
          const contentType = response
            ? response.headers["content-type"] ?? "text/html"
            : "text/html";
          extension = contentType.split("/")[1];
          extension = extension.toUpperCase();
          if (response && response.body) {
            if (this["crawl" + extension]) {
              this["crawl" + extension](url, response);
            } else {
              console.log(`No crawler for extension ${extension}`);
            }
          }
        }
        this.urlMap[url] = true;
      });
    }
  }

  // HTML / XML logic

  /**
   *
   * @param {*} url - the url of the current page
   * @param {*} response - the response of the current request
   */
  async crawlHTML(url, response) {
    const { $ } = parseCode(response.body,response.header);
    const root = $('*:nth-child(1)')[0];
    this.analyzeMLElement(url, $, root);
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

  async analyzeMLElement(url, $, element) {
    let done = false;
    const elementHash = cheerio.html(element);
    for (const key in this.urlFilters[url]?.selectors ?? []) {
      const selectedList = $(key);
      const selected = selectedList.filter(
        (x) => cheerio.html(selectedList[x]) === elementHash
      );
      if (
        selected.length &&
        this.urlFilters[url].selectors[key]?.analyzeMLElement
      ) {
        done =
          (await this.urlFilters[url].selectors[key].analyzeMLElement(
            url,
            $,
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
