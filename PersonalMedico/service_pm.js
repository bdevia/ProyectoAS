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
  console.log(`Service_pm: Connected to host ${sshConfig.host} on port ${sshConfig.port}`);

    sshClient.forwardOut('127.0.0.1', 0, targetHost, targetPort, (err, stream) => {
        if (err) {
            console.error('Error en el canal de reenvío de puertos:', err);
            sshClient.end();
            return;
        }

        console.log(`Service_pm: Connected to System_Bus on port ${targetPort}`);

        // Registramos servicio en bus
        console.log('Service_pm: Registering service on System_Bus...')
        stream.write('00010sinitsvpmi');

        // Recibir datos desde el túnel SSH
        stream.on('data', (data) => {
          console.log('System_Bus:', data.toString());

          if(process.options(data.toString()) == 0){
            console.log("Service_pm: Service svpmi registed on System_Bus")
            console.log("Service_pm: Waiting for requests");
            console.log("");
          }
          else if(process.options(data.toString()) == 1){
            throw new Error("No es posbile conectar el sevicio svpmi en Bus");
            
          }
          else if(process.options(data.toString()) == 2){
            console.log("Service_pm: Process query")
            const datos = process.stream(data.toString());
            //console.log(datos);

            if(datos[2] == 'items'){

                let string = datos[1] + '|';
                const query = "SELECT * FROM inventario;";
                clientDB.query(query, (err, res) => {
                    if (err) {
                      console.error('Error al ejecutar la consulta:', err);
                    } 
                    else {
                      if(res.rowCount >= 1){
                        const rows = res.rows;
                        rows.forEach(row => {
                           string = string + row.id + ';' + row.name_product + ';' + row.cantidad + ';' + row.descripcion+ '|';
                        });
                        
                        console.log("Service_pm: send reply: ", process.response('Successful', string));
                        stream.write(process.response('Successful', string));
                        console.log("");
                      }
                      else{
                        console.log("Service_pm: send reply: ", process.response('Failed', string));
                        stream.write(process.response('Failed', string));
                        console.log("");
                      }
                    }
                  });
            }


            else if(datos[2] == 'getitem'){
                const string = datos[1] + ' ' + datos[2] + ' ' + datos[3] + ' ' + datos[4] + ' ' + datos[5]; //es el 3

                const query = `SELECT id FROM inventario WHERE name_product = '${datos[4]}';`;
                clientDB.query(query, (err, res) => {
                    if (err) {
                      console.error('Error al ejecutar la consulta:', err);
                    } 
                    else { 
                      if(res.rowCount >= 1){

                        const ID = res.rows[0].id;
                        const query1 = `SELECT cantidad FROM inventario WHERE id = ${ID};`;
                        clientDB.query(query1, (err, res) => {
                          if (err) {
                            console.error('Error al ejecutar la consulta:', err);
                          } 
                          else { 
                            if(res.rowCount >= 1){

                              const cantidad = res.rows[0].cantidad;
                              if(cantidad >= datos[5]){
                                const query2 = `UPDATE inventario SET cantidad = ${cantidad-datos[5]} WHERE id = ${ID};`;
                                clientDB.query(query2, (err, res) => {
                                  if (err) {
                                    console.error('Error al ejecutar la consulta:', err);
                                  } 
                                  else { 
                                    const query3 = `INSERT INTO transacciones_inventario (username, name_product, fecha_operacion, tipo_operacion, cantidad) VALUES ('${datos[3]}', '${datos[4]}', CURRENT_TIMESTAMP, 4, ${datos[5]});`;
                                    clientDB.query(query3, (err, res) => {
                                      if (err) {
                                        console.error('Error al ejecutar la consulta:', err);
                                      } 
                                      else { 
                                        console.log("Service_pm: send reply: ", process.response('Successful', string));
                                        stream.write(process.response('Successful', string));
                                        console.log("");
                                      }
                                    });
                                  }
                                });

                              }
                              else{
                                console.log("Service_pm: send reply: ", process.response(`Failed 2 ${datos[4]} ${cantidad}`, string));
                                stream.write(process.response(`Failed 2 ${datos[4]} ${cantidad}`, string));
                                console.log("");
                              }

                            }
                            else{
                              console.log("Service_pm: send reply: ", process.response('Failed', string));
                              stream.write(process.response('Failed', string));
                              console.log("");
                            }
                          }
                        });

                      }
                      else{
                        console.log("Service_pm: send reply: ", process.response(`Failed 1 ${datos[4]}`, string));
                        stream.write(process.response(`Failed 1 ${datos[4]}`, string));
                        console.log("");
                      }
                    }
                  });

            }
            
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
 
// sudo docker run -it --rm --name service_pm --network network_arqui service_pm