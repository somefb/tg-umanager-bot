// as alternative use the following code for creation generateCert.cmd file
// rem use in powershell cmd /c generateCert.cmd
// rem https://www.openssl.org/docs/man1.0.2/man1/openssl-req.html
// "c:\Program Files\Git\usr\bin\openssl.exe" req -x509 -sha256 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=*.elasticbeanstalk.com'
// "c:\Program Files\Git\usr\bin\openssl.exe" rsa -in key.pem -out key.pem

/* eslint-disable @typescript-eslint/no-var-requires */
const selfsigned = require("selfsigned");
const fs = require("fs");

console.log("Certificate. Generating...");

const attrs = [
  {
    name: "commonName",
    // todo fix certificate name
    value: "ec2-18-157-223-65.eu-central-1.compute.amazonaws.com",
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
