import json

with open('app_data.json', 'r', encoding='utf-8') as f:
    app_data = json.load(f)

with open('app_logic.js', 'r', encoding='utf-8') as f:
    js_template = f.read()

# Replace placeholders
final_js = js_template.replace('__JSON_TXS__', json.dumps(app_data['json_txs']))
final_js = final_js.replace('__JSON_SEEDS__', json.dumps(app_data['json_seeds']))
final_js = final_js.replace('__CSV_RAW__', json.dumps(app_data['csv_raw']))
final_js = final_js.replace('__CSV_SEEDS__', json.dumps(app_data['csv_seeds']))
final_js = final_js.replace('__XML_RAW__', json.dumps(app_data['xml_raw']))
final_js = final_js.replace('__XML_SEEDS__', json.dumps(app_data['xml_seeds']))

with open('d:/offline_bitcoin/app.js', 'w', encoding='utf-8') as f:
    f.write(final_js)

print('app.js written successfully! Size:', len(final_js))
