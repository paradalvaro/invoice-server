const soap = require("soap");

const url =
  "https://www.dataaccess.com/webservicesserver/NumberConversion.wso?WSDL";
/*const options = {
  forceHttp: true, // A veces ayuda si el SSL da problemas
  disableCache: true,
};*/
/*const options = {
  connection: "keep-alive",
  // Tiempo de espera en milisegundos (ej. 30 segundos)
  timeout: 30000,
};

const connectSoap = async () => {
  return soap.createClientAsync(url, options);
};
*/
const https = require("https");

// Creamos un agente nativo de Node.js
const agent = new https.Agent({
  keepAlive: true,
  family: 4, // Fuerza IPv4 (esto corrige tu error ENETUNREACH)
  timeout: 30000,
});

const options = {
  // Usamos 'httpsAgent' para versiones nuevas (basadas en axios)
  // O 'agent' para versiones que aún usan 'request'
  requestConfig: {
    httpsAgent: agent,
    headers: {
      Connection: "keep-alive",
    },
  },
  // Esto es para la descarga del WSDL inicial
  wsdl_options: {
    httpsAgent: agent,
  },
};
const connectSoap = async () => {
  const client = await soap.createClientAsync(url, options);
  client.addHttpHeader("Connection", "keep-alive");
  return client;
};
module.exports = connectSoap;
