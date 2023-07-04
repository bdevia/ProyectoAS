const Client = require('ssh2').Client;
const clear = require('clear');
const readline = require('readline');
const { option } = require('yargs');
//const killContainer = require('./process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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
console.log("");
// Variables globales
/*let services = [
  {name: "svlog", status: "down", dupicated: ""},
  {name: "svpmd", status: "down", dupicated: ""},
  {name: "sveit", status: "down", dupicated: ""},
  {name: "svale", status: "down", dupicated: ""},
  {name: "svurs", status: "down", dupicated: ""}
];*/

const services = [
  {name: "svlog", status: "down"},
  {name: "svcus", status: "down"},
  {name: "svcit", status: "down"},
  {name: "svpmi", status: "down"},
  {name: "svalt", status: "down"}
];

//     [init, login status, query1_pm, query2_pm, query1_ei, query2_ei, query3_ei, query4_ei, query5_ei, query6_ei, query7_ei, alertas, query1_cus, query2_cus, query3_cus, query4_cus, query5_cus, query6_cus]
let flags = [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]; // Utilizados para sincronizar

let usuario = {
  id: "", 
  id_admin: "",
  type_user: "",
  username: "", 
  name: ""
};

//Iniciamos la conexion al bus
sshClient.on('ready', () => {
  // Configurar un canal de reenvío de puertos (túnel SSH)
  console.log(`Client: connected to host ${sshConfig.host} on port ${sshConfig.port}`);

    sshClient.forwardOut('127.0.0.1', 0, targetHost, targetPort, (err, stream) => {
        if (err) {
            console.error('Error en el canal de reenvío de puertos:', err);
            sshClient.end();
            return;
        }

        console.log(`Client: connected to System_Bus on port ${targetPort}`);

        // Solicitamos los servicios disponibles:
        console.log('Client: requesting available services...');
        stream.write('00005getsv');


        // Recibir datos desde el túnel SSH
        stream.on('data', (data) => {          
          //console.log(data.toString());

          if(flags[0]){ // flag login inicial

            init_services(data); // inicializacion de servicios disponibles
            //console.log(data.toString());
            console.log("Client: service status:");
            console.log(services);

            if(services[0].status == 'up'){
              //clear();
              let title1 = "Bienvenido(a) al sistema de Inventario";
              let title2 = "Por favor, inicia sesion para acceder al sistema";

              sincronizar_flags(1); // para ejecutar respuesta del login
              console.log("");
              init_login(title1, title2, stream);
              
            }
            else{
              console.log("Service_login no disponible, intente mas tarde");
            }
          }
          
          // Aca se despliegan los menus
          else if(flags[1]){ // Respuesta de login
            if(services[0].status == 'up'){
              if(data.includes('Successful')){
                clear();
                let datos = data.toString();
                datos = datos.split(';');
                let aux = {id: datos[2], id_admin: datos[3], type_user: datos[4], username: datos[5], name: datos[6]};
                usuario = aux;
                //console.log(usuario);

                if(usuario.type_user == "personal_medico"){

                  menu_pm(stream);
                }
                else if(usuario.type_user == "encargado_inventario"){

                  menu_ei(stream);
                }
                else if(usuario.type_user == "admin"){
                  menu_admin(stream);
                }

              }
              else if(data.includes('Failed')){
                let title1 = "usuario o contraseña incorrecto, verifique las credenciales";
                let title2 = "";
                console.log("");
                init_login(title1, title2, stream);

              }
              else{
                console.log("Error, no se puede comprobar las credenciales, intente mas tarde");
              }
            }
            else{
              console.log("Service_login no disponible, intente mas tarde");
            }
          }

          else if(flags[2]){ // estado de query 1 personal_medico
            if(data.includes('Successful')){
              clear();
              let datos = data.toString();
              datos = datos.split('|');
              console.log("Lista de items en inventario:")
              let aux2 = [];
              for(let i=1; i<datos.length-1; i++){
                let aux1 = datos[i].split(";");
                aux2.push({ID: aux1[0], producto: aux1[1], cantidad: aux1[2], descripcion: aux1[3]});
              }
              console.log(aux2);
              console.log("");
              volver(stream, usuario.type_user);
            }
            else if(data.includes('Failed')){
              console.log("No es posible procesar esta solicitud, intente mas tarde");
              console.log("");
              menu_pm(stream);
            }
          }

          else if(flags[3]){ // estado de query 2 personal_medico
            if(data.includes('Successful')){
              console.log("");            
              console.log("Retire el producto en bodega");
              console.log("");

              volver(stream, usuario.type_user);
            }
            else if(data.includes('Failed')){
              let datos = data.toString();
              datos = datos.split(' ');
              //console.log(datos);
              
              if(datos[6] == 1){
                console.log("");
                console.log(`Error, ${datos[7]} no existe en los registros\n`);
                volver(stream, usuario.type_user);
              }
              else if(datos[6] == 2){ 
                if(datos[8] == 0){
                  console.log(`\nError, ya no hay ${datos[7]} en stock, notifique al encargado de inventario\n`);
                  volver(stream, usuario.type_user);
                }
                else{
                  console.log("");
                  console.log(`Error, solo quedan ${datos[8]} ${datos[7]} en stock\n`);
                  option_2_pm(stream);
                }
              }
            }
          }

          else if(flags[4]){  // estado de query 1 encargado_inventario
            if(data.includes("DONE!")){
              //console.log("datos done: ", data.toString());
              let datos = data.toString();
              datos = datos.split('|');
              console.log("Lista de items en inventario:")
              let aux2 = [];
              for(let i=1; i<datos.length-1; i++){
                let aux1 = datos[i].split(";");
                aux2.push({id: aux1[0], producto: aux1[1],cantidad: aux1[3], descripcion: aux1[2], precio: aux1[4]});
              }
              console.log(aux2);
            }
            else if(data.includes("No hay items")){
              console.log("");
              console.log("No existen registros en el inventario");
            }
            console.log("")
            volver(stream, usuario.type_user);
          }

          else if(flags[5]){  // estado de query 2 encargado_inventario
            if(data.includes("DONE!")){
              //console.log("datos done: ", data.toString());
              let datos = data.toString();
              datos = datos.split(";");
              let aux = {id: datos[1], producto: datos[2],cantidad: datos[4], descripcion: datos[3], precio: datos[5]};
                console.log(aux);
            }
            else if(data.includes("El item no existe")){
              console.log("");
              console.log("No existe registro del item en el inventario");
              
            }
            console.log("")
            volver(stream, usuario.type_user);
          }

          else if(flags[6]){  // estado de query 3 encargado_inventario
            if(data.includes("DONE!")){
              let datos = data.toString();
              datos = datos.split('|');
              console.log("Transacciones:")
              for(let i=1; i<datos.length-1; i++){
                let aux1 = datos[i].split(";");
                let tipo_operacion = "";
                if(aux1[4] == 1){
                  tipo_operacion = "creacion";
                }
                else if(aux1[4] == 2){
                  tipo_operacion = "reposicion";
                }
                else if(aux1[4] == 3){
                  tipo_operacion = "eliminacion";
                }
                else if(aux1[4] == 4){
                  tipo_operacion = "retiro";
                }
                else if(aux1[4] == 5){
                  tipo_operacion = "actualizacion";
                }
              
                let aux2 = {id: aux1[0], username: aux1[1], name_product: aux1[2], fecha_operacion: aux1[3], tipo_operacion: tipo_operacion, cantidad: aux1[5]};
                console.log(aux2);
              }
            }
            else if(data.includes("No data")){
              console.log("");
              console.log("No existen registros dentro del rango ingresado");
            }
            console.log("")
            volver(stream, usuario.type_user);
          }

          else if(flags[7]){  // estado de query 4 encargado_inventario
            if(data.includes("item repuesto")){
              console.log("");
              console.log("Reposicion exitosa");
            }
            else if(data.includes("Failed: No existe el item")){
              console.log("");
              console.log("No existe registro del item en inventario");
            }
            console.log("");
            volver(stream, usuario.type_user);
          }

          else if(flags[8]){  // estado de query 5 encargado_inventario
            if(data.includes("Create Item")){
              console.log("");
              console.log("Item creado correctamente");
            }
            else if(data.includes("Failed 1")){
              console.log("");
              console.log("Este item ya se encuentra ingresado");
            }
            console.log("");
            volver(stream, usuario.type_user);
          }

          else if(flags[9]){  // estado de query 6 encargado_inventario
            if(data.includes("item actualizado")){
              console.log("");
              console.log("Item actualizado correctamente");
            }
            else if(data.includes("Failed: nombre de producto ya existe")){
              console.log("");
              console.log("Ya existe un producto con este nombre, verifique nombre de producto");
            }
            else if(data.includes("Failed: no existe el item")){
              console.log("");
              console.log("No existe en los registros el item, verifique ID");
            }
            console.log("");
            volver(stream, usuario.type_user);
          }

          else if(flags[10]){ // estado de query 7 encargado_inventario
            if(data.includes("item eliminado")){
              console.log("");
              console.log("Item eliminado correctamente");
            }
            else if(data.includes("Failed: no existe el producto")){
              console.log("");
              console.log("No existe el producto indicado, verifique nombre");
            }
            console.log("");
            volver(stream, usuario.type_user);
          }

          else if(flags[11]){ // estado de alertas
            if(data.includes("Alertas enviadas a los encargados.")){
              console.log("");
              console.log("Alertas enviadas a los encargados.");
            }
            else if(data.includes("No hay productos con cantidad insuficiente en el inventario.")){
              console.log("");
              console.log("No hay productos con cantidad insuficiente en el inventario.");
            }
            console.log("");
            volver(stream, usuario.type_user);
          }

          else if(flags[12]){  // estado de query 1 crud users (create)
            //console.log("llega data");
            if(data.includes("Create in user")){
              console.log("");
              console.log("Usuario creado correctamente.");
            }
            else if(data.includes("ya existe Failed")){
              console.log("");
              console.log("Error, este usuario ya se encuentra en los registro, valide la informacion.");
            }
            console.log("");
            volver(stream, usuario.type_user);
          }

          else if(flags[13]){  // estado de query 2 crud users (readALL)
            if(data.includes("DONE!")){
              console.log("datos done: ", data.toString());
              let datos = data.toString();
              datos = datos.split('|');
              console.log("Lista de usuarios en el sistema:")
              let aux3 = [];
              for(let i=1; i<datos.length-1; i++){
                let aux1 = datos[i].split(":");
                //string = string + " " + row.id_admin + " " + row.username + " " + row.password + " " + row.type_user + " " + row.name + " " + row.mail + " " + row.telefono + "|";
                aux3.push({id: aux1[0], id_admin: aux1[1], username: aux1[2], password: aux1[3], type_user: aux1[4], name: aux1[5], mail: aux1[6], telefono: aux1[7]});
              }
              console.log(aux3);
            }
            else if(data.includes("No hay usuarios")){
              console.log("");
              console.log("No existen usuarios registrados");
            }
            console.log("")
            volver(stream, usuario.type_user);
          }

          else if(flags[14]){  // estado de query 3 crud users (readusername)
            if(data.includes("DONE!")){
              //console.log("datos done: ", data.toString());
              let dato1 = data.toString();
              let datos = dato1.split('|');
              let aux1 = datos[1].split(":");
              let aux2 = {username: aux1[0], id: aux1[1], id_admin: aux1[2], password: aux1[3], type_user: aux1[4], name: aux1[5], mail: aux1[6], telefono: aux1[7]};
              console.log(aux2);
            }
            else if(data.includes("Failed: usuario no existe")){
              console.log("");
              console.log("No existe registro del usuario en el sistema");
              
            }
            console.log("")
            volver(stream, usuario.type_user);
          }

          else if(flags[15]){  // estado de query 4 crud users (readALLuser_type)
            if(data.includes("DONE!")){
              //console.log("datos done: ", data.toString());
              let datos = data.toString();
              datos = datos.split('|');
              console.log("Lista de usuarios en el sistema:")
              
              let aux3 = [];
              for(let i=1; i<datos.length-1; i++){
                let aux1 = datos[i].split(":");
                //string = string + " " + row.id_admin + " " + row.username + " " + row.password + " " + row.type_user + " " + row.name + " " + row.mail + " " + row.telefono + "|";
                aux3.push({username: aux1[0], id: aux1[1], id_admin: aux1[2], password: aux1[3], type_user: aux1[4], name: aux1[5], mail: aux1[6], telefono: aux1[7]});
              }
              console.log(aux3);
            }
            else if(data.includes("No hay usuarios")){
              console.log("");
              console.log("No existen usuarios registrados");
            }
            console.log("")
            volver(stream, usuario.type_user);
          }

          else if(flags[16]){  // estado de query 5 crud users (update)
            if(data.includes("user UPDATE")){
              console.log("");
              console.log("user UPDATE");
            }
            else if(data.includes("Failed: No existe el usuario")){
              console.log("");
              console.log("Failed: No existe el usuario indicado");
            }
            console.log("");
            volver(stream, usuario.type_user);
          }

          else if(flags[17]){ // estado de query 6 crud users (delete)
            if(data.includes("user_ID DELETE")){
              console.log("");
              console.log("DONE!");
            }
            else if(data.includes("Failed")){
              console.log("");
              console.log("Failed");
            }
            console.log("");
            volver(stream, usuario.type_user);
          }
          // fin
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

// Metodos
rl._writeToOutput = function _writeToOutput(stringToWrite) {
  if (rl.stdoutMuted)
    rl.output.write("\x1B[2K\x1B[200D"+rl.query+""+((rl.line.length%2==1)?"":"")+"");
  else
    rl.output.write(stringToWrite);
};

const newStream = (input) => {
    const largo = String(input.length).padStart(5, '0');
    return largo.concat(input);
};

function init_services(data){
  const datos = data.toString();
  for(let i=0; i<services.length; i++){
    if(datos.includes(services[i].name)){
      services[i].status = "up";
    }
    if(datos.includes(services[i].name, datos.indexOf(services[i].name) + 1)){
      services[i].dupicated = 'true';
    }
    else{
      services[i].dupicated = 'false';
    }
  }
};

function init_login(title1, title2, stream){
  console.log(title1);
  console.log(title2);

  rl.stdoutMuted = false;
  rl.query = "> username: ";
  rl.question(rl.query, (user) => {
    rl.stdoutMuted = true;
    rl.query = "> password: ";
    rl.question(rl.query, (password) => {
      console.log("");
      const request = services[0].name + ' ' + user + ' ' + password;
      stream.write(newStream(request));
    });
  });    

};

function init_bienvenida(){
  console.log(`¡Bienvenido(a)!: ${usuario.name}`);
  console.log(`type_user: ${usuario.type_user}`);
  console.log("");
}

function sincronizar_flags(ejecuta_flag){
  //ejecuta_flag indica que flag debe ejecutarse, todos los otros se apagan
  for(let i=0; i<flags.length; i++){
    if(i == ejecuta_flag){
      flags[ejecuta_flag] = true;
    }
    else{
      flags[i] = false;
    }
  }
}

function volver(stream, type_user){
  rl.query = "> desea volver al menu? (1. si / 2. no): ";
  rl.question(rl.query, (input) => {
    if(input == 1){
      clear();
      if(type_user == "admin"){
        menu_admin(stream);
      }
      else if(type_user == "personal_medico"){
        menu_pm(stream);
      }
      else if(type_user == "encargado_inventario"){
        menu_ei(stream);
      }
    }
    else if(input == 2){
      clear();
      sincronizar_flags(1); // Volvemos a ver el estado del login
      let title1 = "Bienvenido(a) al sistema de Inventario";
      let title2 = "Por favor, inicia sesion para acceder al sistema";

      init_login(title1, title2, stream);
    }
    else{
      console.log("Opcion invalida, intente nuevamente");
      volver(stream, type_user);
    }
  });
}

// Metodos para personal medico
function menu_pm(stream){
  init_bienvenida();
  console.log("Seleccione una opcion:");

  console.log("1. Items disponibles en inventario");
  console.log("2. Retirar insumo");
  console.log("");
  console.log("0. logout");
  console.log("");

  rl.stdoutMuted = false;
  rl.query = "> ";
  rl.question(rl.query, (option) => {
    if(option == 0){

      clear();
      sincronizar_flags(1);   // para leer el estado de login
      let title1 = "Bienvenido(a) al sistema de Inventario";
      let title2 = "Por favor, inicia sesion para acceder al sistema";
      init_login(title1, title2, stream);

    }
    else if(option == 1 || option == 2){

      if(services[3].status == "up"){

        if(option == 1){ 
          clear();
          sincronizar_flags(2); // true para analizar la respuesta de la query 1 personal medico a ejecutar
          const request = services[3].name + ' items' ;
          stream.write(newStream(request)); 
        }

        else if(option == 2){
          clear();
          option_2_pm(stream);
        }

      }
      else{
        console.log("Service_pm no disponible, intente mas tarde");
        console.log("");
        menu_pm(stream);
      }

    }
    else{
      clear();
      console.log("Opcion invalida, intente nuevamente");
      console.log("");
      menu_pm(stream);
    }

  });              
}

function option_2_pm(stream){
  console.log("Ingrese el nombre y la cantidad del producto a retirar:")
  console.log("");

  if(services[3].status == "up"){
    let counter = 1;
    let product;
    let cantidad;

    rl.on('line', (input) => {
      if (counter === 1) {
        product = input;
        counter++;
        rl.setPrompt('> cantidad: ');
        rl.prompt();
      } else if (counter === 2) {
        if (isNaN(input)) {
          console.log('\nError: cantidad debe ser expresado como valor numérico\n');
          rl.prompt();
          return;
        }
        cantidad = input;
        counter++;
        //rl.close();

        sincronizar_flags(3); // Necesitamos analizar la respuesta de la query 2 personal_medico a ejecutar
        const request = services[3].name + ' getitem ' + usuario.username + ' ' + product + ' ' + cantidad;
        stream.write(newStream(request));
      }
    });
    rl.setPrompt('> nombre: ');
    rl.prompt();
  }
  else{
    console.log("Service_pm no disponible, intente mas tarde");
    console.log("");
    menu_pm(stream);
  }
}

// Metodos para encargado inventario
function menu_ei(stream){
  init_bienvenida();
  console.log("Seleccione una opcion:");

  console.log("1. Lista de items en inventario");
  console.log("2. Buscar item por nombre");
  console.log("3. Registro de transacciones");
  console.log("4. Reponer item");
  console.log("5. Crear nuevo item");
  console.log("6. Actualziar item");
  console.log("7. Eliminar item");
  console.log("");
  console.log("0. logout");
  console.log("");

  rl.stdoutMuted = false;
  rl.query = "> ";
  rl.question(rl.query, (option) => {
    if(option == 0){

      clear();
      sincronizar_flags(1); // ver estado del login
      let title1 = "Bienvenido(a) al sistema de Inventario";
      let title2 = "Por favor, inicia sesion para acceder al sistema";
      init_login(title1, title2, stream);

    }
    else if(option == 1 || option == 2 || option == 3 || option == 4 || option == 5 || option == 6 || option == 7){
      if(services[2].status == "up"){

        if(option == 1){ 
          clear();
          sincronizar_flags(4); // para leer repsuesta a query 1 encargado_inventario
          const request = services[2].name + ';read;items';
          stream.write(newStream(request)); 
        }
        else if(option == 2){
          clear();
          console.log("Busqueda de item por nombre, ingresa el nombre del producto:");
          rl.query = "> producto: ";
          rl.question(rl.query, (product) => {
              sincronizar_flags(5); // Necesitamos analizar la respuesta de la query 2 encargado_inventario a ejecutar
              const request = services[2].name + ';read;one;' + product;
              stream.write(newStream(request));
          }); 
          
        }
        else if(option == 3){
          clear();
          console.log("Lista de transacciones efectuadas dentro de los ultimos x dias");
          console.log("");
          console.log("Ingresa la cantidad de dias para definir el margen de busqueda:");
          
          let counter = 1;
          let last_days;

          rl.on('line', (input) => {
            if (counter === 1) {
              if (isNaN(input)) {
                console.log('\nError: cantidad dias debe ser un valor numérico\n');
                rl.prompt();
                return;
              }
              last_days = input;
              counter++;
              sincronizar_flags(6); // Necesitamos analizar la respuesta de la query 2 encargado_inventario a ejecutar
              const request = services[2].name + ';read;transacciones;' + last_days;
              stream.write(newStream(request));
            } 
          });
          rl.setPrompt('> cantidad dias: ');
          rl.prompt();

        }
        else if(option == 4){
          clear();
          console.log("Reposicion de stock\n");
          console.log("Ingrese el nombre y la cantidad del producto a reponer");

          let counter = 1;
          let product;
          let cantidad;
          
          rl.on('line', (input) => {
            if (counter === 1) {
              product = input;
              counter++;
              rl.setPrompt('> cantidad: ');
              rl.prompt();
            } else if (counter === 2) {
              if (isNaN(input)) {
                console.log('\nError: cantidad debe ser expresado como valor numérico\n');
                rl.prompt();
                return;
              }
              cantidad = input;
              counter++;
              sincronizar_flags(7); // Necesitamos analizar la respuesta de la query 5 encargado_inventario a ejecutar
              const request = services[2].name + ';update;reponer;' + usuario.username + ';' + product + ';' + cantidad;
              stream.write(newStream(request));
            }
          });
          rl.setPrompt('> nombre producto: ');
          rl.prompt();

        }
        else if(option == 5){
          clear();
          console.log("Creacion de nuevo item\n");
          console.log("Ingrese los datos solicitados a continuacion:");
          let counter = 1;
          let product;
          let descripcion;
          let cantidad;
          let precio;
          
          rl.on('line', (input) => {
            if (counter === 1) {
              product = input;
              counter++;
              rl.setPrompt('> descripcion: ');
              rl.prompt();
            } 
            else if(counter === 2){
              descripcion = input;
              counter++;
              rl.setPrompt('> cantidad: ');
              rl.prompt();
            }
            else if (counter === 3) {
              if (isNaN(input)) {
                console.log('\nError: cantidad debe ser expresado como valor numérico\n');
                rl.prompt();
                return;
              }
              cantidad = input;
              counter++;
              rl.setPrompt('> precio: ');
              rl.prompt();
            }
            else if (counter === 4) {
              if (isNaN(input)) {
                console.log('\nError: precio debe ser expresado como valor numérico\n');
                rl.prompt();
                return;
              }
              precio = input;
              counter++;
              sincronizar_flags(8); // Necesitamos analizar la respuesta de la query 4 encargado_inventario a ejecutar
              const request = services[2].name + ';create;' + usuario.username + ';' + product + ';' + descripcion + ';' + cantidad + ';' + precio;
              stream.write(newStream(request));
            }
          });
          rl.setPrompt('> nombre producto: ');
          rl.prompt();
        }
        else if(option == 6){
          clear();
          console.log("Actualizacion de item\n")
          console.log("Ingrese los datos solicitados a continuacion:");

          let counter = 1;
          let id_item;
          let product;
          let descripcion;
          let cantidad;
          let precio;

          rl.on('line', (input) => {
            if(counter == 1){
              if (isNaN(input)) {
                console.log('\nError: ID_item debe ser expresado como valor numérico\n');
                rl.prompt();
                return;
              }
              id_item = input;
              counter++;
              rl.setPrompt('> nombre producto: : ');
              rl.prompt();
            }
            else if (counter === 2) {
              product = input;
              counter++;
              rl.setPrompt('> descripcion: ');
              rl.prompt();
            } 
            else if(counter === 3){
              descripcion = input;
              counter++;
              rl.setPrompt('> cantidad: ');
              rl.prompt();
            }
            else if (counter === 4) {
              if (isNaN(input)) {
                console.log('\nError: cantidad debe ser expresado como valor numérico\n');
                rl.prompt();
                return;
              }
              cantidad = input;
              counter++;
              rl.setPrompt('> precio: ');
              rl.prompt();
            }
            else if (counter === 5) {
              if (isNaN(input)) {
                console.log('\nError: precio debe ser expresado como valor numérico\n');
                rl.prompt();
                return;
              }
              precio = input;
              counter++;
              sincronizar_flags(9); // Necesitamos analizar la respuesta de la query 4 encargado_inventario a ejecutar
              const request = services[2].name + ';update;item;' + usuario.username + ';' + id_item+ ';' + product + ';' + descripcion + ';' + cantidad + ';' + precio;
              stream.write(newStream(request));
            }
          });
          rl.setPrompt('> ID_item: ');
          rl.prompt();
        }
        else if(option == 7){
          clear();
          console.log("Eliminacion de item\n");
          console.log("Ingrese el dato solicitado a continuacion:")
          rl.query = "> nombre producto: ";
          rl.question(rl.query, (product) => {
            sincronizar_flags(10); // Necesitamos analizar la respuesta de la query 5 encargado_inventario a ejecutar
            const request = services[2].name + ';delete;' + usuario.username + ';' + product;
            stream.write(newStream(request));
          }); 
        }
      }
      else{
        console.log("Service_pm no disponible, intente mas tarde");
        console.log("");
        menu_pm(stream);
      }
    }
    else{
      clear();
      console.log("Opcion invalida, intente nuevamente");
      console.log("");
      menu_ei(stream);
    }

  });           

}

// Metodos para admin
function menu_admin(stream){
  init_bienvenida();
  console.log("Seleccione una opcion:");

  console.log("1. Activar alertas de bajo inventario");
  console.log("2. Crear nuevo usuario");
  console.log("3. Mostrar todos los usuarios");
  console.log("4. Buscar usuario por username");
  console.log("5. Buscar usuario por tipo");
  console.log("6. Actualziar credenciales de usuario");
  console.log("7. Eliminar usuario");
  console.log("8. Acceso funciones de encargado de inventario");
  console.log("");
  console.log("0. logout");
  console.log("");

  rl.stdoutMuted = false;
  rl.query = "> ";
  rl.question(rl.query, (option) => {
    if(option == 0){

      clear();
      sincronizar_flags(1); // ver estado del login
      let title1 = "Bienvenido(a) al sistema de Inventario";
      let title2 = "Por favor, inicia sesion para acceder al sistema";
      init_login(title1, title2, stream);

    }
    else if(option == 1){
      if(services[4].status == "up"){

          clear();
          sincronizar_flags(11); // para leer repsuesta a service_alertas
          const request = services[4].name + ' 1';
          stream.write(newStream(request));
          console.log("Procesando alertas...");
          //console.log("Servicio realizado correctamente");
      }
      
      else{
        console.log("Service_alertas no disponible, intente mas tarde");
        console.log("");
        menu_admin(stream);
      }

    }

    else if(option == 2 || option == 3 || option == 4 || option == 5 || option == 6 || option == 7){
      if(services[1].status == "up"){

        if(option == 2){
          clear();
          console.log("Ingrese los datos para ingresar un nuevo usuario\n");
          let counter = 1;
          let username;
          let password;
          let type_user;
          let name;
          let mail;
          let telefono;

          rl.on('line', (input) => {
            if (counter === 1) {
              username = input;
              counter++;
              rl.setPrompt('> password: ');
              rl.prompt();
            } else if (counter === 2) {
              password = input;
              counter++;
              rl.setPrompt('> type_user: ');
              rl.prompt();
            }
            else if (counter === 3) {
              type_user = input;
              counter++;
              rl.setPrompt('> name: ');
              rl.prompt();
            }
            else if (counter === 4) {
              name = input;
              counter++;
              rl.setPrompt('> mail: ');
              rl.prompt();
            }
            else if (counter === 5) {
              mail = input;
              counter++;
              rl.setPrompt('> telefono: ');
              rl.prompt();
            }
            else if (counter === 6) {
              if (isNaN(input)) {
                console.log('\nError: El telefono debe ser un valor numérico.\n');
                rl.prompt();
                return;
              }
              telefono = parseFloat(input);
              counter++;
              sincronizar_flags(12); 
              const request = services[1].name + ':create:' + usuario.id + ':' + username + ':' + password + ':' + type_user + ':' + name + ':' + mail + ':' + telefono;
              stream.write(newStream(request));

            }
          });

          rl.setPrompt('> username: ');
          rl.prompt();
        }

        else if(option == 3){ 
          clear();
          sincronizar_flags(13); // para leer repsuesta a query 2 CRUD users (readALL)
          const request = services[1].name + ':read:all';
          stream.write(newStream(request)); 
        }
        else if(option == 4){
          clear();
          console.log("Busqueda de usuario por username, ingresa el username del usuario a buscar:");
          rl.query = "> username: ";
          rl.question(rl.query, (username) => {
              sincronizar_flags(14); // Necesitamos analizar la respuesta de la query 3 del CRUD users (readONEusername)
              const request = services[1].name + ':read:one:' + username;
              stream.write(newStream(request));
          }); 
          
        }

        else if(option == 5){
          clear();
          console.log("Busqueda de usuario por tipo de usuario, ingresa el tipo de usuario a buscar:");
          rl.query = "> type_user: ";
          rl.question(rl.query, (type_user) => {
              sincronizar_flags(15); // Necesitamos analizar la respuesta de la query 4 del CRUD users (readONEtype_user)
              const request = services[1].name + ':read:user:' + type_user;
              stream.write(newStream(request));
          }); 
          
        }
        
        else if(option == 6){
          clear();
          console.log("Ingrese los datos del usuario a actualizar");
          rl.query = "> ID_user: ";
          rl.question(rl.query, (ID_user) => {
            rl.query = "> username: ";
          rl.question(rl.query, (username) => {
            rl.query = "> password: ";
            rl.question(rl.query, (password) => {
              rl.query = "> type_user: ";
              rl.question(rl.query, (type_user) => {
                rl.query = "> name: ";
                rl.question(rl.query, (name) => {
                  rl.query = "> mail: ";
                rl.question(rl.query, (mail) => {
                  rl.query = "> telefono: ";
                rl.question(rl.query, (telefono) => {
                  sincronizar_flags(16); 
                  const request = services[1].name + ':update:' + ID_user + ':' + usuario.id + ':' + username + ':' + password + ':' + type_user + ':' + name + ':' + mail + ':' + telefono;
                  stream.write(newStream(request));

                    });
                  });
                }); 
              }); 
            }); 
          });
        });

        }
        else if(option == 7){
          clear();
          console.log("Eliminacion de usuario");
          rl.query = "> ID_usuario: ";
          rl.question(rl.query, (ID_user) => {
            sincronizar_flags(17); // Necesitamos analizar la respuesta de la query 5 encargado_inventario a ejecutar
            const request = services[1].name + ':delete:' + ID_user;
            stream.write(newStream(request));
          }); 
        }

      }
      else{
        console.log("Service_crud_users no disponible, intente mas tarde");
        console.log("");
        menu_admin(stream);
      }

    }

    else if(option == 8){
      if(services[2].status == "up"){

          clear();
          menu_ei(stream);
      }
      
      else{
        console.log("Service_EI no disponible, intente mas tarde");
        console.log("");
        menu_admin(stream);
      }

    }
    else{
      clear();
      console.log("Opcion invalida, intente nuevamente");
      console.log("");
      menu_admin(stream);
    }

  });           

}
// sudo docker run -it --rm --name client --network network_arqui client