const nodemailer = require('nodemailer');
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

// Configuración del servicio de correo
const emailConfig = {
  host: 'smtp.office365.com', // Reemplaza con la dirección del servidor SMTP
  port: 587, // Reemplaza con el puerto del servidor SMTP
  secure: false, // Si el servidor SMTP requiere una conexión segura (SSL/TLS), cambia a true
  auth: {
    user: 'alertasarqui@hotmail.com', // Reemplaza con el nombre de usuario del correo electrónico
    pass: 'UDP2023.' // Reemplaza con la contraseña del correo electrónico
  }
};

// Crear una instancia de cliente SSH
const sshClient = new Client();
clear();

sshClient.on('ready', () => {
  // Configurar un canal de reenvío de puertos (túnel SSH)
  console.log(`Service_alertas: Connected to host ${sshConfig.host} on port ${sshConfig.port}`);

  sshClient.forwardOut('127.0.0.1', 0, targetHost, targetPort, (err, stream) => {
    if (err) {
      console.error('Error en el canal de reenvío de puertos:', err);
      sshClient.end();
      return;
    }

    console.log(`Service_alertas: Connected to System_Bus on port ${targetPort}`);

    // Registramos servicio en bus
    console.log('Service_alertas: Registering service on System_Bus...');
    stream.write('00010sinitsvale');

    // Recibir datos desde el túnel SSH
    stream.on('data', (data) => {
      console.log('System_Bus:', data.toString());

      if (process.options(data.toString()) === 0) {
        console.log('Service_alerts: Service svalt registered on System_Bus');
        console.log('Service_alerts: Waiting for requests');
        console.log('');
      } else if (process.options(data.toString()) === 1) {
        throw new Error('No es posible conectar el servicio svalt en Bus');
      } else if (process.options(data.toString()) === 2) {
        console.log('Service_alerts: Process query');
        const datos = process.stream(data.toString());
        console.log(datos);

        if (datos[2] === '1') {

          // Opción seleccionada: Activar alertas
          console.log('Verificando alertas...');
          let string = datos[1];
          // Consultar el inventario
          const inventarioQuery = 'SELECT * FROM inventario;';
          clientDB.query(inventarioQuery, async (err, inventarioRes) => {
            if (err) {
              console.error('Error al obtener el inventario:', err);
            } else {
              const productosInsuficientes = [];

              // Verificar la cantidad de cada producto en el inventario
              for (const producto of inventarioRes.rows) {
                if (producto.cantidad < 5) {
                  productosInsuficientes.push(producto);
                }
              }

              if (productosInsuficientes.length > 0) {
                console.log("Enviando Correos...");
                // Consultar los usuarios encargados
                const encargadosQuery = "SELECT * FROM users WHERE type_user = 'encargado_inventario';";
                clientDB.query(encargadosQuery, async (err, encargadosRes) => {
                  if (err) {
                    console.error('Error al obtener los encargados de inventario:', err);
                  } else {
                    const transporter = nodemailer.createTransport(emailConfig);

                    // Enviar un correo por cada encargado
                    for (const encargado of encargadosRes.rows) {
                      const correoEncargado = encargado.mail;
                      const productosCorreo = productosInsuficientes
                        .map((producto) => `${producto.name_product}: ${producto.cantidad}`)
                        .join('\n');

                      const mailOptions = {
                        from: 'alertasarqui@hotmail.com', // Reemplaza con tu dirección de correo electrónico
                        to: correoEncargado,
                        subject: 'Alerta de Inventario - Productos con cantidad insuficiente',
                        text: `Estimado encargado,

Los siguientes productos tienen cantidad insuficiente en el inventario:

${productosCorreo}

Por favor, tome las medidas necesarias para reponer los productos.

Atentamente,
El Sistema de Alertas`
                      };

                      await transporter.sendMail(mailOptions);
                      console.log(`Correo enviado a ${correoEncargado}`);
                    }
                    console.log('Alertas enviadas a los encargados.');
                    stream.write(process.response('Alertas enviadas a los encargados.', string));
                  }
                });
              } else {
                console.log('No hay productos con cantidad insuficiente en el inventario.');
                stream.write(process.response('No hay productos con cantidad insuficiente en el inventario.', string));
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