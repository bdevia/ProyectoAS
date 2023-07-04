//const clientDB = require('./clientDB');

const options = (data) => {
    if(data.includes('OK')){
        return 0;
    }
    else if(data.includes('NK')){
        return 1;
    }
    else if(!data.includes('OK') && !data.includes('NK')){
        return 2;
    }
};

const response = (result, string) => {
    const aux = string + ' ' + result;
    const largo = String(aux.length).padStart(5, '0');
    return largo + aux;
};


const stream = (data) =>{
    var tamaño = 5;
    const subcadenas = [];

    var y=0;
    for (let i = 0; i < data.length; i += tamaño) {
        if(y==2){
            tamaño = parseInt(subcadenas[0]) - 5;
            var aux = data.substring(i, i + tamaño);
            aux = aux.split(';');
            subcadenas.push(aux[1]);
            subcadenas.push(aux[2]);
            subcadenas.push(aux[3]);
            subcadenas.push(aux[4]);
            subcadenas.push(aux[5]);
            subcadenas.push(aux[6]);
            subcadenas.push(aux[7]);
            subcadenas.push(aux[8]);
            subcadenas.push(aux[9]);
            subcadenas.push(aux[10]);
        }
        else{
            subcadenas.push(data.substring(i, i + tamaño));
        }
        y += 1;
    };

//console.log(subcadenas)
return subcadenas;
};


const process = {stream, options, response};
module.exports = process;