const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');
const nodemailer = require('nodemailer');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
// const bcrypt = require('bcrypt'); // ← Activa esto si deseas encriptar contraseñas

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }
});
const port = 3001;
app.use(session({
  secret: 'clave-secreta-segura', // Cámbiala por una más segura en producción
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // true si usas HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Middleware
app.use(cors({
  origin: true, // Permitir cualquier origen
  credentials: true // ⚠️ IMPORTANTE: Permitir cookies
}));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/public', express.static('public'));



// Conexión a MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'renc1012339245',
  database: 'Visitdata'
});

db.connect(err => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err);
    process.exit(1);
  }
  console.log('✅ Conectado a la base de datos.');
});

// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'car02cbs@gmail.com',
    pass: 'ashy kjyq qawr uajb' // contraseña de aplicación
  }
});

// Rutas
app.get('/ping', (req, res) => {
  res.send('✅ Servidor funcionando');
});

// ✅ RUTA PARA VERIFICAR SESIÓN (DEBE ESTAR ANTES DE OTRAS RUTAS)
app.get('/api/me', (req, res) => {
  console.log('🔍 Verificando sesión:', req.session);
  if (req.session.usuario) {
    res.json({ 
      success: true,
      user: req.session.usuario 
    });
  } else {
    res.status(401).json({ 
      success: false,
      error: 'No autenticado' 
    });
  }
});

// Registrar visita
app.post('/register', (req, res) => {
  const { representante, fecha, ciudad, institucion, barrio, niño, edad, años, meses, gestacion } = req.body;
  const query = `
    INSERT INTO visitas 
    (representante, fecha, ciudad, institucion, barrio, niño, edad, años, meses, gestacion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(query, [representante, fecha, ciudad, institucion, barrio, niño, edad, años, meses, gestacion], (err) => {
    if (err) {
      console.error('❌ Error al guardar datos:', err);
      return res.status(500).send('Error al guardar datos');
    }
    res.status(200).send('✅ Datos guardados correctamente');
  });
});

// Obtener visitas
app.get('/registros', (req, res) => {
  db.query('SELECT * FROM visitas', (err, results) => {
    if (err) return res.status(500).json({ error: 'Error en el servidor' });
    res.json(results);
  });
});

// Eliminar visita
app.delete('/registros/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await db.promise().query('DELETE FROM visitas WHERE id = ?', [id]);
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar el registro' });
  }
});

// Editar visita
app.put('/registros/:id', async (req, res) => {
  const id = req.params.id;
  const { representante, fecha, ciudad, institucion, barrio, niño, edad, años, meses, gestacion } = req.body;
  try {
    await db.promise().query(
      `UPDATE visitas SET representante=?, fecha=?, ciudad=?, institucion=?, barrio=?, niño=?, edad=?, años=?, meses=?, gestacion=? WHERE id=?`,
      [representante, fecha, ciudad, institucion, barrio, niño, edad, años, meses, gestacion, id]
    );
    res.json({ message: 'Registro actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el registro' });
  }
});

// Registrar usuario
app.post('/registro-usuario', async (req, res) => {
  const { nombre, email, password, confirmar } = req.body;

  if (!nombre || !email || !password || !confirmar) {
    return res.status(400).send('Todos los campos son obligatorios');
  }

  if (password !== confirmar) {
    return res.status(400).send('Las contraseñas no coinciden');
  }

  try {
    const [existingUser] = await db.promise().query('SELECT * FROM usuarios WHERE email = ?', [email]);

    if (existingUser.length > 0) {
      return res.status(400).send('Este correo ya está registrado');
    }

    // const hashedPassword = await bcrypt.hash(password, 10); // ← Activa si usas bcrypt
    await db.promise().query(
      'INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)',
      [nombre, email, password] // Reemplaza con hashedPassword si usas bcrypt
    );

    const mailOptions = {
      from: 'car02cbs@gmail.com',
      to: email,
      subject: 'Registro exitoso',
      html: `<h2>¡Hola ${nombre}!</h2><p>Gracias por registrarte. Tu cuenta ha sido creada con éxito.</p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return res.status(500).json('Usuario creado, pero no se pudo enviar el correo');
      } else {
        res.status(200).json('✅ Usuario registrado y correo enviado');
      }
    });

  } catch (err) {
    res.status(500).json('Error en el servidor');
  }
});

// ✅ LOGIN CORREGIDO
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Faltan datos' });
  }

  try {
    const [results] = await db.promise().query(
      'SELECT * FROM usuarios WHERE email = ? AND password = ?',
      [email, password]
    );

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    req.session.usuario = {
      id: results[0].id,
      nombre: results[0].nombre,
      email: results[0].email
    };

    res.json({
      success: true,
      message: 'Login exitoso',
      user: req.session.usuario,
      redirectUrl: '/public/html/chat.html'
    });

  } catch (err) {
    console.error('❌ Error en /login:', err);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});


app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al cerrar sesión' });
    }
    res.json({ success: true, message: 'Sesión cerrada' });
  });
});  
  

// Obtener usuarios
app.get('/usuarios', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT id, nombre, email FROM usuarios');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Eliminar usuario
app.delete('/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.promise().query('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// Editar usuario
app.put('/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, email, password } = req.body;
  try {
    await db.promise().query(
      'UPDATE usuarios SET nombre = ?, email = ?, password = ? WHERE id = ?',
      [nombre, email, password, id]
    );
    res.json({ message: 'Usuario actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// ✅ WebSocket MEJORADO
const usuariosConectados = new Map();

io.on('connection', socket => {
  console.log(`🟢 Usuario conectado por socket: ${socket.id}`);

  // Cuando un usuario se une al chat
  socket.on('join', nombreUsuario => {
    if (!nombreUsuario || nombreUsuario.trim() === "") {
      console.warn('⚠️ Nombre de usuario inválido');
      return;
    }

    usuariosConectados.set(socket.id, {
      nombre: nombreUsuario,
      id: socket.id
    });
    
    console.log(`📌 ${nombreUsuario} se ha conectado con ID: ${socket.id}`);

    // Notificar a todos los clientes de la lista de usuarios actualizada
    const listaUsuarios = Array.from(usuariosConectados.entries()).map(([socketId, usuario]) => ({
      id: socketId,
      nombre: usuario.nombre
    }));

    io.emit('usuarios-conectados', listaUsuarios);
  });
  
    // Manejar mensajes públicos
    socket.on('chat message', ({ username, message }) => {
      if (!username || !message) return;
      io.emit('chat message', { username, message });
    });
  
    // Manejar mensajes privados
    socket.on('mensaje-privado', ({ destinatarioId, mensaje, remitente }) => {
      if (usuariosConectados.has(destinatarioId)) {
        io.to(destinatarioId).emit('mensaje-privado', {
          mensaje,
          remitente
        });
      } else {
        console.warn(`⚠️ Usuario con ID ${destinatarioId} no está conectado`);
      }
    });
  
    // Cuando un usuario se desconecta
    socket.on('disconnect', () => {
      const nombreDesconectado = usuariosConectados.get(socket.id);
      console.log(`🔴 Usuario desconectado: ${nombreDesconectado || socket.id}`);
      usuariosConectados.delete(socket.id);
  
      // Notificar a los demás clientes
      io.emit('usuarios-conectados', Array.from(usuariosConectados.entries()).map(([id, nombre]) => ({
        id,
        nombre
      })));
    });
  });

  
// Error 404
app.use((req, res) => {
  res.status(404).send('Ruta no encontrada');
});

//////
app.use(session({
  secret: 'clave-secreta-segura', // Cámbiala por una más segura en producción
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // true si usas HTTPS
}));


// Iniciar servidor
server.listen(port, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${port}`);
});
app.get('/api/me', (req, res) => {
    if (req.session.usuario) {
      res.json({ user: req.session.usuario });
    } else {
      res.status(401).json({ error: 'No autenticado' });
    }
  });
  




