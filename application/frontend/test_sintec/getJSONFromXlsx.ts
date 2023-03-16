import readXlsxFile from 'read-excel-file';

async function getJSONFromXlsx(path_xlsx) {
    try {
        const rows = await readXlsxFile(path_xlsx);
        console.log(rows);
    } catch (error) {
        console.error(error);
    }
}

const PATH = 'C:\Users\julio.quinones\Documents\projects\repos\routing-fleet-google\application\frontend\test_sintec\Plantilla.xlsx';
getJSONFromXlsx(PATH);