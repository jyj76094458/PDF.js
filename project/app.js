var express = require('express');
var path = require('path');
var app = express();
app.listen(81);

app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.use(express.static(path.join(__dirname)));

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'pdfjs.html'));
});