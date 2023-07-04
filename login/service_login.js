const Client = require('ssh2').Client;
const clientDB = require('./clientDB');
const process = require('./process');
const clear = require('clear');

// Establecer la información de conexión al servidor SSH
const sshConfig = {
  host: '200.14.84.16',
  port: 8080,
  username: 'benjamin.devia1',
  password: 'losdeabajo13'
};

// Establecer la información de conexión al servidor final
const targetHost = 'localhost';
const targetPort = 5000;

// Crear una instancia de cliente SSH
const sshClient = new Client();
clear();

sshClient.on('ready', () => {
  // Configurar un canal de reenvío de puertos (túnel SSH)
  console.log(`Service_login: Connected to host ${sshConfig.host} on port ${sshConfig.port}`);

    sshClient.forwardOut('127.0.0.1', 0, targetHost, targetPort, (err, stream) => {
        if (err) {
            console.error('Error en el canal de reenvío de puertos:', err);
            sshClient.end();
            return;
        }

        console.log(`Service_login: Connected to System_Bus on port ${targetPort}`);

        // Registramos servicio en bus
        console.log('Service_login: Registering service on SYstem_Bus...')
        stream.write('00010sinitsvlog');

        // Recibir datos desde el túnel SSH
        stream.on('data', (data) => {
          console.log('System_Bus:', data.toString());

          if(process.options(data.toString()) == 0){
            console.log("Service_login: Service svlog registed on System_Bus")
            console.log("Service_login: Waiting for requests");
            console.log("");
          }
          else if(process.options(data.toString()) == 1){
            throw new Error("No es posbile conectar el sevicio svlog en Bus");
            
          }
          else if(process.options(data.toString()) == 2){
            console.log("Service_log: Process query")
            const datos = process.stream(data.toString());
            //console.log(datos);

            const query = `SELECT * FROM users WHERE username='${datos[2]}' AND password='${datos[3]}';`;
            clientDB.query(query, (err, res) => {
              if (err) {
                console.error('Error al ejecutar la consulta:', err);
              } 
              else {  
                let string = datos[1];
                if(res.rowCount >= 1){
                  string = string + `;${datos[1]};${res.rows[0].id};${res.rows[0].id_admin};${res.rows[0].type_user};${res.rows[0].username};${res.rows[0].name};`
                  console.log("Service_log: send reply: ", process.response(`Successful`, string));
                  stream.write(process.response(`Successful`, string));
                  console.log("");
                }
                else{
                  console.log("Service_log: send reply: ", process.response('Failed: usuario o contraseña incorrecto', string));
                  stream.write(process.response('Failed', string));
                  console.log("");
                }
              }
            });

          }

        });
      
        // Cerrar el túnel SSH y la conexión SSH cuando hayas terminado
        stream.on('close', () => {
          sshClient.end();
        });
    });
});

sshClient.on('error', (err) => {
  console.log('Error en la conexión SSH:', err);
  sshClient.end();
});

// Conectar al servidor SSH
sshClient.connect(sshConfig);
 
// sudo docker run -it --rm --name service_login --network network_arqui service_login