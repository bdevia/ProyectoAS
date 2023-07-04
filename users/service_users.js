const Client = require('ssh2').Client;
const net = require('net');
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
  console.log(`Service_users: Connected to host ${sshConfig.host} on port ${sshConfig.port}`);

    sshClient.forwardOut('127.0.0.1', 0, targetHost, targetPort, (err, stream) => {
        if (err) {
            console.error('Error en el canal de reenvío de puertos:', err);
            sshClient.end();
            return;
        }

        console.log(`Service_users: Connected to System_Bus on port ${targetPort}`);

        // Realizar logica para la transferencia de datos
        console.log('Service_users: Registering service on System_Bus...')
        stream.write('00010sinitsvcus');

        // Recibir datos desde el túnel SSH
        stream.on('data', (data) => {
            console.log('System_Bus:', data.toString());

            if(process.options(data.toString()) == 0){
                //conexion exitosa
                console.log("Service_users: Service svcus registed on System_Bus")
                console.log("Service_users: Waiting for requests");
                console.log("");
            }
            else if(process.options(data.toString()) == 1){
                //conexion fallida
                throw new Error("No es posbile conectar el sevicio svcus en Bus");
            }
            else if(process.options(data.toString()) == 2){
                //ya estoy conectado y busco hacer querys
                //aca se recive la data en forma de string separados por espacios
                //lo que queda en la posicion [0] es el nombre del servicio del bus y data poco relevante
                //en la posicion [2] se encontrara la opcion, de momento: 
                //0 -> create, 1 -> delete, 2 -> read, 3 -> update
                
                console.log("Service_users: Process query");
                const subcadenas = process.stream(data.toString());
                //console.log(subcadenas)

                const option = subcadenas[2]

                //Si la opcion es 0 se crea el usuario svcus create 1 nombre1 name admin elpepe pepe@mail 452
                if(option === 'create'){

                    const ID_admin = subcadenas[3]
                    const username = subcadenas[4]
                    const password = subcadenas[5]
                    const type_user = subcadenas[6] 
                    const name = subcadenas[7]
                    const mail = subcadenas[8]
                    const telefono = subcadenas[9]
                    const string = subcadenas[1] + ' ' + subcadenas[4];  

                    const query = `SELECT * FROM users WHERE username = '${username}';`
                    clientDB.query(query,(err, res)=>{
                      if(err){
                        console.error('Error al ejecutar la consulta 1:', err);
                      }else{
                        //console.log(res.rows.length)
                        if (res.rows.length != 0) {
                          console.log("Send Reply: ", process.response('ya existe Failed', string));
                          stream.write(process.response('ya existe Failed', string));
                          console.log("");
                        }else{
                          const query1 = `INSERT INTO "users" (ID_admin, type_user, username, "password", "name", mail, telefono) VALUES ($1, $2, $3, $4, $5, $6, $7)`
                      
                          clientDB.query(query1, [ID_admin, type_user, username, password, name, mail, telefono], (err, res) => {
                              if (err) {
                                console.error('Error al ejecutar la consulta2:', err);
                              } 
                              else {
                                if(res.rowCount >= 1){
                                  console.log("Send Reply: ", process.response('Create in user', string));
                                  stream.write(process.response('Create in user', string));
                                  console.log("");
                                }
                                else{
                                  console.log("Send Reply: ", process.response('Failed', string));
                                  stream.write(process.response('Failed', string));
                                  console.log("");
                                }
                              }
                            });

                        }

                      }
                      
                      })
                }
                //Si la opcion es 1 se borra el usuario con la id en subcadenas[3]
                if(option == 'delete'){
                  const ID_user = subcadenas[3]
                  const string = subcadenas[1] + " " + ID_user
                  //console.log(ID_user)
                  const query = `DELETE FROM "users" WHERE ID = $1`
                  clientDB.query(query, [ID_user], (err, res) => {
                    if(err){
                      console.error('Error al ejecutar la consulta:', err)
                    }
                    else{
                      //console.log(res)
                      if(res.rowCount >= 1){
                        console.log("Send Reply: ", process.response('user_id DELETE', string));
                        stream.write(process.response('user_ID DELETE', string));
                        console.log("");
                      }
                      else{
                        console.log("Send Reply: ", process.response('Failed', string));
                        stream.write(process.response('Failed', string));
                        console.log("");
                      }
                    }
                  });
                }
                //Si la opcion es 2 se muestra el usuario con la id en subcadenas[3]
                if(option == 'read'){
                  const type = subcadenas[3]
                  //si es type one lee solo un usuario el cual le entregamos el id 
                  if(type === 'one'){
                    const username = subcadenas[4]; 
                    let string = subcadenas[1] + "|" + username
                    const query = `SELECT * FROM "users" WHERE username = $1`
                    clientDB.query(query,[username],(err, res) =>{
                      if(err){
                        console.error('Error al ejecutar la consulta: ', err)
                      }
                      else{
                        if (res.rows.length === 0) {
                          console.log("Send Reply: ", process.response('Failed', string));
                          stream.write(process.response('Failed: usuario no existe', string));
                          console.log("");
                        } else {
                          const rows = res.rows;
                          //console.log(rows)
                          rows.forEach((row) =>{
                            string = string + ":" + row.id + ":" + row.id_admin + ":" + row.password + ":" + row.type_user + ":" + row.name + ":" + row.mail + ":" + row.telefono + "|";
                          });
                          //console.log(string)
                          console.log("Send Reply: ", process.response('DONE!', string));
                          stream.write(process.response('DONE!', string));
                          console.log("");
                        }

                      }
                    });
                  }
                  //si el type es all muestra todos los usuarios
                  else if(type === 'all'){
                    var string = subcadenas[1] + "|";
                    const query = `SELECT * FROM users;`
                    clientDB.query(query,(err, res)=>{
                      if(err){
                        console.error('Error al ejecutar la consulta: ', err);
                      }else{
                        if (res.rows.length === 0) {
                          console.log("Send Reply: ", process.response('Failed', string));
                          stream.write(process.response('Failed', string));
                          console.log("");
                        }else{
                          const rows = res.rows;
                          //console.log(rows)
                          rows.forEach((row) =>{
                            string = string + row.id + ":" +row.id_admin + ":" +  row.username + ":" + row.password + ":" + row.type_user + ":" + row.name + ":" + row.mail + ":" + row.telefono + "|";
                          });
                          console.log(string)
                          console.log("Send Reply: ", process.response('DONE!', string));
                          stream.write(process.response('DONE!', string));
                          console.log("");
                        }
                      }
                    })
                  }
                  //si el typo es user, debe proporcionar un segundo parametro con el tipo de usuario que quiere
                  else if(type === 'user'){
                    var string = subcadenas[1] + "|";
                    const type_user = subcadenas[4];
                    console.log(type)
                    console.log(type_user)
                    const query = `SELECT * FROM users WHERE type_user = '${type_user}';`
                    clientDB.query(query, (err, res)=>{
                      if(err){
                        console.error('Error al ejecutar la consulta: ', err)
                      }else{
                        if (res.rows.length === 0) {
                          console.log("Send Reply: ", process.response('Failed', string));
                          stream.write(process.response('tipo de usuario no existe', string));
                          console.log("");
                        }else{
                          const rows = res.rows;
                          //console.log(rows)
                          rows.forEach((row) =>{
                            string = string + row.username + ":" + row.id +":" +row.id_admin  + ":" + row.password + ":" + row.type_user + ":" + row.name + ":" + row.mail + ":" + row.telefono + "|";
                          });
                          console.log(string)
                          console.log("Send Reply: ", process.response('DONE!', string));
                          stream.write(process.response('DONE!', string));
                          console.log("");
                        }
                      }
                    });
                  }
                }
                //Si la opcion es 3 se hace el update de usuario
                if(option == 'update'){
                  const ID_user = subcadenas[3]
                  const ID_admin = subcadenas[4]
                  const username = subcadenas[5]
                  const password = subcadenas[6]
                  const type_user = subcadenas[7] 
                  const name = subcadenas[8]
                  const mail = subcadenas[9]
                  const telefono = subcadenas[10]
                  var string = subcadenas[1] + '|' + ID_user;

                  const query2 = `SELECT * FROM users WHERE username = '${username}'`
                  clientDB.query(query2,(err, res)=>{
                    if(err){
                      console.error("Error al ejecutar la consulta 1")
                    }else{
                      //console.log(ID_user)
                      const rows = res.rows
                      var id = ""
                      rows.forEach((row) =>{
                        id = id + row.id
                      });
                      //console.log(id)
                      if(res.rowCount === 1 && id != ID_user){
                        console.log("Send Reply: ", process.response('Failed', string));
                        stream.write(process.response(`Failed: el username ${username} ya existe`, string));
                        console.log("");
                      }else{
                        const query = `SELECT * FROM users WHERE ID = '${ID_user}';`;
                        clientDB.query(query,(err, res) =>{
                          if(err) {
                            console.error('Error al ejecutar la consulta 2', err)
                          }else{
                            if(res.rowCount >= 1){
                              const query1 = `UPDATE users SET ID_admin = ${ID_admin}, type_user = '${type_user}', username = '${username}', "password" = '${password}', "name" = '${name}', mail = '${mail}', telefono = ${telefono} WHERE id = ${ID_user};`
                              clientDB.query(query1,(err, res)=>{
                                if(err){
                                  console.error('Error al ejecutar la consulta 3', err)
                                }else{
                                  console.log("Send Reply: ", process.response('user UPDATE', string));
                                  stream.write(process.response('user UPDATE', string));
                                  console.log("");
                                }
                              });
                            }else{
                              console.log("Send Reply: ", process.response('Failed', string));
                              stream.write(process.response(`Failed: No existe el usuario ${ID_user}`, string));
                              console.log("");
                            }
                          }
                          
                        });
                      }
                    }
                  })
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
// sudo docker run -it --rm --name service_users --network network_arqui service_users