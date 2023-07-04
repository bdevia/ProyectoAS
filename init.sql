SET timezone = 'America/Santiago';

CREATE TABLE IF NOT EXISTS "users"(ID SERIAL PRIMARY KEY, ID_admin INT, type_user VARCHAR(255), username VARCHAR(255), "password" VARCHAR(255), "name" VARCHAR(255), mail VARCHAR(255), telefono INT);
CREATE TABLE IF NOT EXISTS "inventario"(ID SERIAL PRIMARY KEY, "name_product" VARCHAR(255), "descripcion" VARCHAR(255), cantidad INT, precio INT);
CREATE TABLE IF NOT EXISTS "transacciones_inventario"(ID SERIAL PRIMARY KEY, username VARCHAR(255) , "name_product" VARCHAR(255), fecha_operacion TIMESTAMP, tipo_operacion INT, cantidad INT);


INSERT INTO users (ID_admin, type_user, username, "password", "name" , mail, telefono) VALUES (1, 'admin', 'admin1', 'pass123','hector salamanca', 'hectors@mail.udp.cl', 945756941);
INSERT INTO users (ID_admin, type_user, username, "password", "name" , mail, telefono) VALUES (1, 'encargado_inventario', 'usuario1', 'pass123', 'walter white', 'benjamim.devia1@mail.udp.cl', 945756942);
INSERT INTO users (ID_admin, type_user, username, "password", "name" , mail, telefono) VALUES (1, 'personal_medico', 'usuario2', 'pass', 'ana vasquez', 'anav@mail.udp.cl', 945756943);

INSERT INTO "inventario" ("name_product", "descripcion", cantidad , precio) VALUES ('tijera', 'tijera para quirofano', 5, 5000);
INSERT INTO "inventario" ("name_product", "descripcion", cantidad , precio) VALUES ('paracetamol', 'pastillas de 500gr', 10, 2000);

INSERT INTO "transacciones_inventario" (username, "name_product", fecha_operacion, tipo_operacion, cantidad) VALUES ('admin', 'tijera', '2023-06-20 01:21:15.104642', 1, 4);
INSERT INTO "transacciones_inventario" (username, "name_product", fecha_operacion, tipo_operacion, cantidad) VALUES ('usuario1', 'paracetamol', '2023-06-15 01:21:15.104642', 4, 2);

