// as alternative use the following code for creation generateCert.cmd file
// rem use in powershell cmd /c generateCert.cmd
// rem https://www.openssl.org/docs/man1.0.2/man1/openssl-req.html
// "c:\Program Files\Git\usr\bin\openssl.exe" req -x509 -sha256 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=*.elasticbeanstalk.com'
// "c:\Program Files\Git\usr\bin\openssl.exe" rsa -in key.pem -out key.pem

/* eslint-disable @typescript-eslint/no-var-requires */
const selfsigned = require("selfsigned");
const fs = require("fs");
const readline = require("readline");

console.log("Certificate. Generating...");

function createCert(CNvalue) {
  const attrs = [
    {
      name: "commonName",
      value: CNvalue, // domain wher is certificate will be used: "yoursite.amazonaws.com",
    },
    {
      name: "countryName",
      value: "BLR",
    },
    {
      shortName: "ST",
      value: "Minsk",
    },
    {
      name: "localityName",
      value: "Minsk",
    },
    {
      name: "organizationName",
      value: "Freedom",
    },
    {
      shortName: "OU",
      value: "Test",
    },
  ];
  const pems = selfsigned.generate(attrs, {
    days: 365,
    algorithm: "sha256",
    keySize: 2048,
  });

  //console.log(pems);

  console.log("Certificate. Writing into files...");
  fs.writeFileSync("./ssl/cert.key", pems.private);
  fs.writeFileSync("./ssl/cert.pem", pems.cert);
  console.log("Certificate. Done");
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.question("Certificate. Enter hostName (CN in certificate) here:", (str) => {
  rl.close();
  createCert(str);
});
