const { Client } = require('pg');

// Configura la información de conexión
const connectionConfig = {
  user: 'user',
  password: '2023',
  host: 'service_postgres',
  port: 5432,
  database: 'proyect', // Conéctate a la base de datos "postgres" para crear la base de datos "Arqui_Software"
};

// Crea una nueva instancia del cliente PostgreSQL
const clientDB = new Client(connectionConfig);

// Conecta al servidor PostgreSQL
setTimeout(() => {
  clientDB.connect()
  .then(() => {
    console.log(`Service_login: Conneted to ${connectionConfig.host} on port ${connectionConfig.port}`);
  })
  .catch((error) => {
    console.error('Error connecting to database', error);
  });
}, 1500);

module.exports = clientDB;