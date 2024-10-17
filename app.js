const scrape = require("./scraper");
const fs = require("fs");

const dataFileName = "pharmacies.csv";
const errorsFileName = "errors.txt";
const verifyFileName = "errors-missing-mail-phone.csv";

// if (fs.existsSync(dataFileName)) process.exit();
fs.writeFileSync(dataFileName, "Nom,Ville,Mail,Téléphone,Adresse,URL\n");
fs.writeFileSync("errors.txt", "");
fs.writeFileSync(verifyFileName, `Name,Mail,Téléphone,URL\n`);
const baseUrl = "https://livmeds.com";

const initialLink = "https://livmeds.com/pharmacies";

const allLinks = [initialLink, baseUrl];
const linksQueues = [initialLink];
const regexLinkSearch = /href="(\/pharmacies\/[^#"]+)"/g;
const regexLinkDetail = /href="(\/pharmacie\/[^#"]+)"/g;
const regexIsDetailPage = /^https?:\/\/[^\/]+\/pharmacie\/([^\/]+)\/([^\/]+)$/;
const findLinkHref = (html) => {
    const length = allLinks.length
  let match;
  while ((match = regexLinkDetail.exec(html)) !== null) {
    const newLink = baseUrl + match[1];
    if (!allLinks.includes(newLink)) {
      fs.appendFileSync("detail-page.txt", newLink + "\n");
      allLinks.push(newLink);
      linksQueues.push(newLink);
    }
  }

  while ((match = regexLinkSearch.exec(html)) !== null) {
    const newLink = baseUrl + match[1];
    if (!allLinks.includes(newLink)) {
      fs.appendFileSync("city-page.txt", newLink + "\n");
      allLinks.push(newLink);
      linksQueues.push(newLink);
    }
  }
  console.log('More ' + (allLinks.length - length) + ' new links')
};

const collectClientData = async (html, city, name, url) => {
  // Regex pour capturer l'adresse
  const regex = /<p class="subSectionRowTitle">Adresse:<\/p>\s*<p>(.*?)<\/p>/g;

  // Extraire l'adresse
  const match = regex.exec(html);
  if (match) {
    const adress = match[1].replace(/<!--.*?-->/gs, "").trim(); // match[1] contient l'adresse
    const [phone, mail] = await Promise.all([
      fetchDetail(name, city, "tel"),
      fetchDetail(name, city, "mail"),
    ]);
    if (!phone || !mail) {
      fs.appendFileSync(verifyFileName, `${name},${mail},${phone},${url}\n`);
    }
    fs.appendFileSync(
      dataFileName,
      `${name.trim()},${city.trim()},${(mail || '').trim()},${(mail || '').trim()},${adress.trim()},${url.trim()}\n`
    );
  } else {
    fs.appendFileSync(errorsFileName, `Adresse non trouvée: ${url}\n`);
  }
};

const analyseUrl = async (url) => {
  try {
    const { html } = await scrape({ url });
    findLinkHref(html);
    let match;
    if ((match = regexIsDetailPage.exec(url))) {
      collectClientData(html, match[1].trim(), match[2].trim(), url.trim());
    }
  } catch (e) {
    fs.appendFileSync(errorsFileName, url + ": " + e.message + "\n");
  }
};

(async () => {
  while (linksQueues.length != 0) {
    await analyseUrl(linksQueues[0]);
    linksQueues.shift();
  }
  console.log('Terminée !!!')
})();

const fetchDetail = async (name, city, type) => {
  return await fetch("https://livmeds.com/api/pharma/getDetail", {
    headers: {
      accept: "*/*",
      "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/json",
      priority: "u=1, i",
    },
    referrerPolicy: "no-referrer",
    body: `{\"name\":\"${name}\",\"city\":\"${city}\",\"type\":\"${type}\"}`,
    method: "POST",
  })
    .then((res) => res.json())
    .then((json) => json.result);
};
