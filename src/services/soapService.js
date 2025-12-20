//const connectSoap = require("../config/soap");
const soap = require("soap");
const url =
  "https://www.dataaccess.com/webservicesserver/NumberConversion.wso?WSDL";

async function convertirNumeroALetras(numero) {
  try {
    const args = { ubiNum: numero };
    soap.createClient(url, {}, function (err, client) {
      try {
        client.NumberToWords(args, function (err, result) {
          console.log(
            `El número ${numero} en letras es: ${result.NumberToWordsResult}`
          );
        });
      } catch (error) {
        console.error("Error en la llamada SOAP:", error);
      }
    });

    //const client = await connectSoap();
    //client.addHttpHeader("Connection", "keep-alive");

    /*console.log(client);
    const description = client.describe();
    */
    //const description = client.describe();
    //console.log(description);
    //const serviceName = Object.keys(description)[0];
    //const portName = Object.keys(description[serviceName])[0];
    //console.log(`Conectado a: ${serviceName} -> ${portName}`);

    //const result = await client.NumberToWords(args);
    //const result = await client[serviceName][portName].NumberToWords(args);
    /*await client[serviceName][portName].NumberToWords(args, (err, result) => {
      if (err) {
        console.error("Error en ejecución:", err);
      } else {
        console.log("Resultado:", result.NumberToWordsResult);
      }
    });*/
    //console.log(`El número ${numero} en letras es: ${result}`);
  } catch (error) {
    console.error("Error en la llamada SOAP:", error);
  }
}

module.exports = convertirNumeroALetras;
