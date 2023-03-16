
// Requiring the module
import pkg from 'xlsx';
const { readFile, utils } = pkg;
  
// Reading our test file
const path_xlsx = './escenario3.xlsx';

function getJSONFromXlsx(xlsx_file) {
    const file = readFile(xlsx_file);
    let data = {};
    const sheets = file.SheetNames;
    for(let i = 0; i < sheets.length; i++) {
        const worksheetName = sheets[i];
        data[worksheetName] = [];
        const rows = utils.sheet_to_json(file.Sheets[worksheetName]);
        rows.forEach( (row) => {
            data[worksheetName].push(row);
        });
    }
    const model = {
        global_start_time: data['Modelo'][0]['global_start'],
        global_end_time: data['Modelo'][0]['global_end'],
        shipments: data['Shipments'].map((item_shipment) => {
            return {
                demands: [
                    {
                        type: 'weight_kilograms',
                        value: String(item_shipment.demanda),
                    },
                ],
                deliveries: [
                    {
                        arrivalLocation: {
                            latitude: data['Ubicaciones'][item_shipment.id]['latitude'],
                            longitude: data['Ubicaciones'][item_shipment.id]['longitude'],
                        },
                        timeWindows: data['TimeWindows']
                            .filter((item) => item.id_shipment === item_shipment.id)
                            .map((item) => {
                                return {
                                    start_time: item.start_time_window,
                                    end_time: item.end_time_window,
                                };
                            }),
                        duration: {
                            seconds: item_shipment.time_service,
                        },
                    },
                ],
            };
        }),
        vehicles: data['Unidades'].map((item_unidades) => {
            return {
                startLocation: {
                    latitude: item_unidades.latitude_salida,
                    longitude: item_unidades.longitude_salida,
                },
                endLocation: {
                    latitude: item_unidades.latitude_llegada,
                    longitude: item_unidades.longitude_llegada,
                },
                capacities: [
                    {
                        type: 'weight_kilograms',
                        value: String(item_unidades.capacidad_peso),
                    },
                ],
                costPerHour: item_unidades.costo_hora,
                costPerKilometer: item_unidades.costo_km,
            };
        }),
    }
    return JSON.parse(String(json_parsed));
}
