const Client = require('ssh2').Client;
const net = require('net');
const clientDB = require('./clientDB');
const process = require('./process');
const clear = require('clear');

// Establecer la información de conexión al servidor SSH
const sshConfig = {
  host: 'IP_Bus',
  port: 'Port',
  username: 'user',
  password: 'password'
};

// Establecer la información de conexión al servidor final
const targetHost = 'localhost';
const targetPort = 5000;

// Crear una instancia de cliente SSH
const sshClient = new Client();
clear();

sshClient.on('ready', () => {
  // Configurar un canal de reenvío de puertos (túnel SSH)
  console.log(`Service_items: Connected to host ${sshConfig.host} on port ${sshConfig.port}`);

    sshClient.forwardOut('127.0.0.1', 0, targetHost, targetPort, (err, stream) => {
        if (err) {
            console.error('Error en el canal de reenvío de puertos:', err);
            sshClient.end();
            return;
        }

        console.log(`Service_items: Connected to System_Bus on port ${targetPort}`);

        // Realizar logica para la transferencia de datos
        console.log('Service_items: Registering service on System_Bus...')
        stream.write('00010sinitsvcit');

        // Recibir datos desde el túnel SSH
        stream.on('data', (data) => {
            console.log('System_Bus:', data.toString());

            if(process.options(data.toString()) == 0){
                //conexion exitosa
                console.log("Service_items: Service svcit registed on System_Bus")
                console.log("Service_items: Waiting for requests");
                console.log("");
            }
            else if(process.options(data.toString()) == 1){
                //conexion fallida
                throw new Error("No es posbile conectar el sevicio svcit en Bus");
            }
            else if(process.options(data.toString()) == 2){
                //ya estoy conectado y busco hacer querys
                //aca se recive la data en forma de string separados por espacios
                //lo que queda en la posicion [0] es el nombre del servicio del bus y data poco relevante
                //en la posicion [2] se encontrara la opcion, de momento: 
                //0 -> create, 1 -> delete, 2 -> read, 3 -> update
                
                console.log("Service_items: Process query");
                const subcadenas = process.stream(data.toString());
                //console.log(subcadenas)

                const option = subcadenas[2]

                //Si la opcion es 0 se crea el usuario svcus create 1 nombre1 name admin elpepe pepe@mail 452
                if(option === 'create'){
                    const username = subcadenas[3];
                    const name_product = subcadenas[4];
                    const descripcion = subcadenas[5];
                    const cantidad = subcadenas[6];
                    const precio = subcadenas[7];

                    const query1 = `SELECT * FROM inventario WHERE name_product = '${name_product}';`;
                    clientDB.query(query1,(err, res)=>{
                        if(err){
                            console.error('Error al ejecutar la consulta:', err)
                        }
                        else{
                            if(res.rowCount >= 1){
                                console.log("Send Reply: ", process.response('Failed 1', string)); // ya existe este producto
                                stream.write(process.response('Failed 1', string));
                                console.log("");
                            }else{
                                const query2 = `INSERT INTO "inventario" ("name_product", "descripcion", cantidad, precio) VALUES ('${name_product}', '${descripcion}', ${cantidad}, ${precio});`;
                                clientDB.query(query2,(err, res)=>{
                                    if(err){
                                        console.error('Error al ejecutar la consulta:', err)
                                    }
                                    else{
                                        const string = subcadenas[1] + ' ' + subcadenas[4];
                                        const query3 = `INSERT INTO "transacciones_inventario" (username, "name_product", fecha_operacion, tipo_operacion, cantidad) VALUES ($1, $2, CURRENT_TIMESTAMP, 1, $3);`
                                        clientDB.query(query3,[username,name_product,cantidad],(err, res)=>{
                                            if(err){
                                                console.error('Error al ejecutar la consulta 3:', err);
                                            }
                                            else{
                                                console.log("Send Reply: ", process.response('Create Item', string));
                                                stream.write(process.response('Create Item', string));
                                                console.log("");
                                            }
                                        })
                                    }
                                });
                            }
                        }
                    });
                }
                //Si la opcion es 1 se borra el usuario con la id en subcadenas[3]
                if(option == 'delete'){ 
                    const username = subcadenas[3];
                    const name_product = subcadenas[4];
                    const string = subcadenas[1];
                    const query1 = `SELECT * FROM inventario WHERE name_product = '${name_product}';`;
                    clientDB.query(query1,(err, res)=>{
                        if(err){
                            console.error('Error al ejecutar la consulta:', err)
                        }
                        else{
                            if(res.rowCount >= 1){
                                const cantidad = res.rows[0].cantidad;
                                const query2 = `DELETE FROM inventario WHERE name_product = '${name_product}';`
                                clientDB.query(query2,(err, res)=>{
                                    if(err){
                                        console.error('Error al ejecutar la consulta:', err)
                                    }else{
                                        if(res.rowCount >= 1){
                                            const query3 = `INSERT INTO "transacciones_inventario" (username, "name_product", fecha_operacion, tipo_operacion, cantidad) VALUES ($1, $2, CURRENT_TIMESTAMP, 3, $3);`
                                            clientDB.query(query3,[username,name_product,cantidad],(err, res)=>{
                                                if(err){
                                                    console.error('Error al ejecutar la consulta 3: ', err)
                                                }else{
                                                    console.log("Send Reply: ", process.response('item eliminado', string));
                                                    stream.write(process.response('item eliminado', string));
                                                    console.log("");
                                                }
                                            })
                                        }else{
                                            console.log("Send Reply: ", process.response('Failed', string));
                                            stream.write(process.response('Failed', string));
                                            console.log("");
                                        }
                                    }
                                })
                            }else{
                                console.log("Send Reply: ", process.response('Failed: no existe el producto', string)); // ya existe este producto
                                stream.write(process.response('Failed: no existe el producto', string));
                                console.log("");
                            }
                        }
                    });
                }
                //Si la opcion es 2 se muestra el usuario con la id en subcadenas[3]
                if(option == 'read'){
                    const type = subcadenas[3];
                    //si la tercera data del bus es de type items lee todos los items
                    if(type === 'items'){
                        var string = subcadenas[1] + "|";
                        const query = `SELECT * FROM inventario`
                        clientDB.query(query,(err, res)=>{
                            if(err){
                                console.error('Error al ejecutar la consulta', err)
                            }else{
                                if (res.rows.length === 0) {
                                    console.log("Send Reply: ", process.response('No hay items', string));
                                    stream.write(process.response('No hay items', string));
                                    console.log("");
                                }else{
                                    const rows = res.rows;
                                    //console.log(rows)
                                    rows.forEach((row) =>{
                                      string = string + row.id + ";" + row.name_product + ";" + row.descripcion + ";" + row.cantidad + ";" + row.precio +  "|";
                                    });
                                    //console.log(string)
                                    console.log("Send Reply: ", process.response('DONE!', string));
                                    stream.write(process.response('DONE!', string));
                                    console.log("");
                                }
                            }
                        });
                    }

                    //si el type es transacciones lee todas las transacciones
                    else if(type === 'transacciones'){
                        var string = subcadenas[1] + '|';
                        const query = `SELECT id, username, name_product, TO_CHAR(fecha_operacion, 'DD/MM/YYYY HH24:MI:SS') AS fecha_operacion, tipo_operacion, cantidad FROM transacciones_inventario WHERE fecha_operacion >= CURRENT_TIMESTAMP - INTERVAL '${subcadenas[4]} days' AND fecha_operacion <= CURRENT_TIMESTAMP`
                        clientDB.query(query,(err, res)=>{
                            if(err){
                                console.error('Error al ejecutar la consulta', err)
                            }else{
                                if (res.rows.length === 0) {
                                    console.log("Send Reply: ", process.response('No data', string));
                                    stream.write(process.response('No data', string));
                                    console.log("");
                                }else{
                                    const rows = res.rows;
                                    //console.log(rows)
                                    rows.forEach((row) =>{
                                      string = string + row.id + ";" + row.username + ";" + row.name_product + ";" + row.fecha_operacion + ";" + row.tipo_operacion + ";" + row.cantidad + '|';
                                    });
                                    console.log(string)
                                    console.log("Send Reply: ", process.response('DONE!', string));
                                    stream.write(process.response('DONE!', string));
                                    console.log("");
                                }
                            }
                        });
                    }

                    //si el type es one lee solo un item con el id x
                    else if(type === 'one'){
                        const nombre_item = subcadenas[4];
                        var string = subcadenas[1];
                        const query = `SELECT * FROM inventario WHERE name_product = '${nombre_item}'`
                        clientDB.query(query,(err, res)=>{
                            if(err){
                                console.error('Error al ejecutar la consulta', err)
                            }else{
                                if (res.rows.length === 0) {
                                    console.log("Send Reply: ", process.response('El item no existe', string));
                                    stream.write(process.response('El item no existe', string));
                                    console.log("");
                                }else{
                                    //console.log(rows)
                                      string = string + ";" + res.rows[0].id + ";" + res.rows[0].name_product + ";" + res.rows[0].descripcion + ";" + res.rows[0].cantidad + ";" + res.rows[0].precio + ';';
                                    //console.log(string)
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
                    const type = subcadenas[3]
                    //si el tipo es reponer solo edita la cantidad de un producto entregando su id
                    if(type === "reponer"){
                        const username = subcadenas[4];
                        const name_product = subcadenas[5];
                        var string = subcadenas[1] + ' ' + name_product;
                        const new_cantidad = parseInt(subcadenas[6]);
                        console.log(`Data: ${username} ${name_product} ${new_cantidad}`);
                        const query1 = `SELECT cantidad FROM inventario WHERE "name_product" = '${name_product}';`;
                        clientDB.query(query1,(err,res)=>{
                            if(err){
                                console.error('Error al ejecutar la consulta 1: ', err)
                            }else{
                                if(res.rowCount >= 1){
                                    var rows = res.rows;
                                    var cantidad = parseInt(rows[0].cantidad);
                                    cantidad = cantidad + new_cantidad;
                                    const query2 = `UPDATE inventario SET cantidad = ${cantidad} WHERE "name_product" = '${name_product}';`
                                    clientDB.query(query2,(err, res)=>{
                                        if(err){
                                            console.error('Error al ejecutar la consulta 2: ', err)
                                        }else{
                                            const query3 = `INSERT INTO "transacciones_inventario" (username, "name_product", fecha_operacion, tipo_operacion, cantidad) VALUES ($1, $2, CURRENT_TIMESTAMP, 2, $3);`
                                            clientDB.query(query3,[username,name_product,new_cantidad],(err, res)=>{
                                                if(err){
                                                    console.error('Error al ejecutar la consulta 3: ', err)
                                                }else{
                                                    console.log("Send Reply: ", process.response('item repuesto', string));
                                                    stream.write(process.response('item repuesto', string));
                                                    console.log("");
                                                }
                                            })
                                        }
                                    })
                                }else{
                                    console.log("Send Reply: ", process.response('Failed', string));
                                    stream.write(process.response(`Failed: No existe el item ${name_product}`, string));
                                    console.log("");
                                }

                            }
                        })
                    }
                    //si el tipo es item edita todo en el item menos la cantidad
                    else if(type === 'item'){
                        const username = subcadenas[4];
                        const ID_item = subcadenas[5];
                        const name_product = subcadenas[6];
                        const descripcion = subcadenas[7];
                        const cantidad = subcadenas[8];
                        const precio = subcadenas[9];
                        var string = subcadenas[1];
                        const query1 = `SELECT * FROM inventario WHERE id = ${ID_item};`;
                        clientDB.query(query1,(err, res)=>{
                            if(err){
                                console.error('Error al ejecutar la consulta 1: ', err)
                            }else{
                                if(res.rowCount >= 1){
                                    const query2 = `SELECT * FROM inventario WHERE name_product = '${name_product}';`
                                    clientDB.query(query2,(err, res)=>{
                                        if(err){
                                            console.error('Error al ejecutar la consulta 3: ', err)
                                        }else{
                                            if(res.rowCount >= 1){
                                                console.log("Send Reply: ", process.response('Failed: nombre de producto ya existe', string));
                                                stream.write(process.response(`Failed: nombre de producto ya existe`, string));
                                                console.log("");
                                            }
                                            else{
                                                const query3 = `UPDATE inventario SET "name_product" = '${name_product}', "descripcion" = '${descripcion}', cantidad = ${cantidad}, precio = ${precio} WHERE id = ${ID_item}`
                                                clientDB.query(query3,(err,res)=>{
                                                    if(err){
                                                        console.error('Error al ejecutar la consulta 2: ', err)
                                                    }else{
                                                        const query4 = `INSERT INTO "transacciones_inventario" (username, "name_product", fecha_operacion, tipo_operacion, cantidad) VALUES ($1, $2, CURRENT_TIMESTAMP, 5, $3);`
                                                        clientDB.query(query4,[username,name_product,cantidad],(err, res)=>{
                                                            if(err){
                                                                console.error('Error al ejecutar la consulta 3: ', err)
                                                            }else{
                                                                console.log("Send Reply: ", process.response('item actualizado', string));
                                                                stream.write(process.response('item actualizado', string));
                                                                console.log("");
                                                            }
                                                        })
                                                    }
                                                })
                                            }
                                        }
                                    }) 
                                    
                                }else{
                                    console.log("Send Reply: ", process.response('Failed: no existe el item', string));
                                    stream.write(process.response(`Failed: no existe el item`, string));
                                    console.log("");
                                }
                            }
                        })
                    }

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
// sudo docker run -it --rm --name service_ei --network network_arqui service_ei
