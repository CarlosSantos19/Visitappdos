const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const app = express();
const port = 3001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'renc1012339245', 
  database: 'Visitdata'
});

db.connect(err => {
  if (err) throw err;
  console.log('Conectado a la base de datos.');
});

app.post('/register', (req, res) => {
  const {
    representante, fecha, ciudad, institucion, barrio,
    niño, edad, años, meses, gestacion
  } = req.body;

  const query = `INSERT INTO visitas 
    (representante, fecha, ciudad, institucion, barrio, niño, edad, años, meses, gestacion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(query, [representante, fecha, ciudad, institucion, barrio, niño, edad, años, meses, gestacion],
    (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).send('Error al guardar datos');
      } else {
        res.status(200).send('Datos guardados correctamente');
      }
    });
});

app.get('/registros', (req, res) => {
    const sql = 'SELECT * FROM registro';
    db.query(sql, (err, results) => {
      if (err) {
        console.error('Error al obtener los registros:', err);
        res.status(500).json({ error: 'Error en el servidor' });
      } else {
        res.json(results);
      }
    });
  });
  

app.listen(port, () => {
  console.log(`Servidor en http://localhost:${port}`);
});
