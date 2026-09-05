/**
 * Bitcoin Forensics & Transaction Traversal Dashboard - Core Engine
 * Offline Transaction Monitoring, Typology Detection & Interactive Graph
 */

// --- Preloaded Offline Datasets ---
const EMBEDDED_DATA = {
  json: {
    txs: [{"timestamp": "2026-08-03T01:54:00Z", "src_ip": "198.51.100.115", "dst_ip": "198.51.100.219", "src_port": 30599, "dst_port": 8333, "txid": "tx_json_0001", "input_addresses": ["bc1qjson0001"], "output_addresses": ["bc1qjson0002", "bc1qjson0003"], "input_amounts": [0.94318578], "output_amounts": [0.21332786, 0.72902248], "geo_country": "SG", "asn": 64500}, {"timestamp": "2026-08-05T09:50:00Z", "src_ip": "198.51.100.95", "dst_ip": "198.51.100.230", "src_port": 60112, "dst_port": 18333, "txid": "tx_json_0029", "input_addresses": ["bc1qjson0079", "bc1qjson0080"], "output_addresses": ["bc1qjson0081"], "input_amounts": [0.76155209, 1.04196243], "output_amounts": [1.8030033], "geo_country": "DE", "asn": 64500}, {"timestamp": "2026-08-04T05:17:00Z", "src_ip": "198.51.100.58", "dst_ip": "198.51.100.96", "src_port": 40704, "dst_port": 8332, "txid": "tx_json_0017", "input_addresses": ["bc1qjson0046"], "output_addresses": ["bc1qjson0047", "bc1qjson0048"], "input_amounts": [0.9883775], "output_amounts": [0.89451038, 0.09302038], "geo_country": "RU", "asn": 64502}, {"timestamp": "2026-08-05T16:09:00Z", "src_ip": "198.51.100.124", "dst_ip": "198.51.100.123", "src_port": 11154, "dst_port": 18333, "txid": "tx_json_0033", "input_addresses": ["bc1qjsonMI0093", "bc1qjsonMI0094", "bc1qjsonMI0095"], "output_addresses": ["bc1qjson0096"], "input_amounts": [0.56355902, 1.26457581, 0.69197397], "output_amounts": [2.51768196], "geo_country": "NL", "asn": 64504}, {"timestamp": "2026-08-03T07:16:00Z", "src_ip": "198.51.100.62", "dst_ip": "198.51.100.80", "src_port": 59685, "dst_port": 18333, "txid": "tx_json_0005", "input_addresses": ["bc1qjson0011"], "output_addresses": ["bc1qjson0012"], "input_amounts": [0.25830478], "output_amounts": [0.25824931], "geo_country": "US", "asn": 64501}, {"timestamp": "2026-08-05T12:46:00Z", "src_ip": "198.51.100.159", "dst_ip": "198.51.100.221", "src_port": 16449, "dst_port": 8332, "txid": "tx_json_0031", "input_addresses": ["bc1qjson0085"], "output_addresses": ["bc1qjson0086", "bc1qjson0087"], "input_amounts": [1.75177367], "output_amounts": [0.88238872, 0.86847799], "geo_country": "IN", "asn": 64500}, {"timestamp": "2026-08-03T23:13:00Z", "src_ip": "198.51.100.167", "dst_ip": "198.51.100.82", "src_port": 34194, "dst_port": 18333, "txid": "tx_json_0014", "input_addresses": ["bc1qjson0035"], "output_addresses": ["bc1qjson0036", "bc1qjson0037"], "input_amounts": [1.58063571], "output_amounts": [0.37438325, 1.20597658], "geo_country": "IN", "asn": 64503}, {"timestamp": "2026-08-04T23:19:00Z", "src_ip": "198.51.100.214", "dst_ip": "198.51.100.249", "src_port": 26073, "dst_port": 18333, "txid": "tx_json_0026", "input_addresses": ["bc1qjson0071"], "output_addresses": ["bc1qjson0072"], "input_amounts": [1.59088775], "output_amounts": [1.58987986], "geo_country": "SG", "asn": 64502}, {"timestamp": "2026-08-05T23:11:00Z", "src_ip": "198.51.100.106", "dst_ip": "198.51.100.203", "src_port": 12083, "dst_port": 8333, "txid": "tx_json_0040", "input_addresses": ["bc1qjsonCJ0114", "bc1qjsonCJ0115", "bc1qjsonCJ0116", "bc1qjsonCJ0117", "bc1qjsonCJ0118"], "output_addresses": ["bc1qjsonCJ0119", "bc1qjsonCJ0120", "bc1qjsonCJ0121", "bc1qjsonCJ0122", "bc1qjsonCJ0123"], "input_amounts": [0.10735999, 0.10656714, 0.10651413, 0.10590693, 0.10693133], "output_amounts": [0.10654336, 0.10654336, 0.10654336, 0.10654336, 0.10654336], "geo_country": "IN", "asn": 64504}, {"timestamp": "2026-08-03T19:17:00Z", "src_ip": "198.51.100.42", "dst_ip": "198.51.100.165", "src_port": 1864, "dst_port": 8333, "txid": "tx_json_0011", "input_addresses": ["bc1qjson0025", "bc1qjson0026"], "output_addresses": ["bc1qjson0027", "bc1qjson0028"], "input_amounts": [0.89419653, 1.49739266], "output_amounts": [1.19522615, 1.19583105], "geo_country": "US", "asn": 64504}, {"timestamp": "2026-08-04T11:18:00Z", "src_ip": "198.51.100.37", "dst_ip": "198.51.100.248", "src_port": 62037, "dst_port": 8333, "txid": "tx_json_0020", "input_addresses": ["bc1qjson0055"], "output_addresses": ["bc1qjson0056"], "input_amounts": [1.40537813], "output_amounts": [1.40436265], "geo_country": "DE", "asn": 64502}, {"timestamp": "2026-08-03T05:06:00Z", "src_ip": "198.51.100.65", "dst_ip": "198.51.100.194", "src_port": 17692, "dst_port": 8332, "txid": "tx_json_0003", "input_addresses": ["bc1qjson0007"], "output_addresses": ["bc1qjson0008"], "input_amounts": [0.93524451], "output_amounts": [0.93454895], "geo_country": "RU", "asn": 64500}, {"timestamp": "2026-08-04T01:46:00Z", "src_ip": "198.51.100.212", "dst_ip": "198.51.100.248", "src_port": 17122, "dst_port": 18333, "txid": "tx_json_0016", "input_addresses": ["bc1qjson0042", "bc1qjson0043"], "output_addresses": ["bc1qjson0044", "bc1qjson0045"], "input_amounts": [1.07925203, 1.55139317], "output_amounts": [1.04136045, 1.58795838], "geo_country": "NL", "asn": 64500}, {"timestamp": "2026-08-03T15:28:00Z", "src_ip": "198.51.100.129", "dst_ip": "198.51.100.247", "src_port": 47617, "dst_port": 8332, "txid": "tx_json_0009", "input_addresses": ["bc1qjson0019"], "output_addresses": ["bc1qjson0020"], "input_amounts": [0.58295475], "output_amounts": [0.58250951], "geo_country": "DE", "asn": 64504}, {"timestamp": "2026-08-06T11:44:00Z", "src_ip": "198.51.100.190", "dst_ip": "198.51.100.65", "src_port": 51783, "dst_port": 8333, "txid": "tx_json_0045", "input_addresses": ["bc1qjsonSEEDIN0139"], "output_addresses": ["bc1qjsonSEED9999"], "input_amounts": [3.57135839], "output_amounts": [3.56992985], "geo_country": "SG", "asn": 64504}, {"timestamp": "2026-08-03T15:46:00Z", "src_ip": "198.51.100.226", "dst_ip": "198.51.100.5", "src_port": 12290, "dst_port": 8332, "txid": "tx_json_0010", "input_addresses": ["bc1qjson0021", "bc1qjson0022"], "output_addresses": ["bc1qjson0023", "bc1qjson0024"], "input_amounts": [1.8817383, 0.26640903], "output_amounts": [1.18407381, 0.96350083], "geo_country": "US", "asn": 64503}, {"timestamp": "2026-08-04T06:49:00Z", "src_ip": "198.51.100.89", "dst_ip": "198.51.100.62", "src_port": 49437, "dst_port": 18333, "txid": "tx_json_0018", "input_addresses": ["bc1qjson0049", "bc1qjson0050"], "output_addresses": ["bc1qjson0051"], "input_amounts": [0.30546156, 1.93289297], "output_amounts": [2.23660708], "geo_country": "US", "asn": 64503}, {"timestamp": "2026-08-05T19:59:00Z", "src_ip": "198.51.100.21", "dst_ip": "198.51.100.20", "src_port": 25985, "dst_port": 8333, "txid": "tx_json_0036", "input_addresses": ["bc1qjsonPEEL0105"], "output_addresses": ["bc1qjsonPEEL0106", "bc1qjsonPEELCHG0107"], "input_amounts": [8.10087731], "output_amounts": [7.91019717, 0.1866297], "geo_country": "IN", "asn": 64500}, {"timestamp": "2026-08-05T18:47:00Z", "src_ip": "198.51.100.23", "dst_ip": "198.51.100.73", "src_port": 28417, "dst_port": 18333, "txid": "tx_json_0034", "input_addresses": ["bc1qjsonMI0097", "bc1qjsonMI0098", "bc1qjsonMI0099"], "output_addresses": ["bc1qjson0100"], "input_amounts": [1.32033768, 0.23610521, 1.16596912], "output_amounts": [2.72181525], "geo_country": "DE", "asn": 64500}, {"timestamp": "2026-08-04T19:54:00Z", "src_ip": "198.51.100.54", "dst_ip": "198.51.100.141", "src_port": 2249, "dst_port": 8332, "txid": "tx_json_0024", "input_addresses": ["bc1qjson0066"], "output_addresses": ["bc1qjson0067"], "input_amounts": [1.70223472], "output_amounts": [1.70110312], "geo_country": "SG", "asn": 64501}, {"timestamp": "2026-08-05T20:27:00Z", "src_ip": "198.51.100.21", "dst_ip": "198.51.100.20", "src_port": 59433, "dst_port": 8333, "txid": "tx_json_0037", "input_addresses": ["bc1qjsonPEEL0106"], "output_addresses": ["bc1qjsonPEEL0108", "bc1qjsonPEELCHG0109"], "input_amounts": [7.91019717], "output_amounts": [7.61837601, 0.28786606], "geo_country": "IN", "asn": 64500}, {"timestamp": "2026-08-06T04:55:00Z", "src_ip": "198.51.100.93", "dst_ip": "198.51.100.169", "src_port": 65122, "dst_port": 8333, "txid": "tx_json_0042", "input_addresses": ["bc1qjsonHV0134"], "output_addresses": ["bc1qjsonSEED9999"], "input_amounts": [75.8905102], "output_amounts": [75.86774305], "geo_country": "IN", "asn": 64501}, {"timestamp": "2026-08-05T19:08:00Z", "src_ip": "198.51.100.222", "dst_ip": "198.51.100.230", "src_port": 24079, "dst_port": 18333, "txid": "tx_json_0035", "input_addresses": ["bc1qjsonMI0101", "bc1qjsonMI0102", "bc1qjsonMI0103"], "output_addresses": ["bc1qjson0104"], "input_amounts": [1.43594421, 0.55275611, 0.28882061], "output_amounts": [2.27622485], "geo_country": "RU", "asn": 64500}, {"timestamp": "2026-08-03T22:53:00Z", "src_ip": "198.51.100.46", "dst_ip": "198.51.100.20", "src_port": 15753, "dst_port": 8332, "txid": "tx_json_0013", "input_addresses": ["bc1qjson0032", "bc1qjson0033"], "output_addresses": ["bc1qjson0034"], "input_amounts": [1.51459424, 1.00419222], "output_amounts": [2.51675443], "geo_country": "US", "asn": 64503}, {"timestamp": "2026-08-05T21:41:00Z", "src_ip": "198.51.100.21", "dst_ip": "198.51.100.20", "src_port": 20884, "dst_port": 8333, "txid": "tx_json_0039", "input_addresses": ["bc1qjsonPEEL0110"], "output_addresses": ["bc1qjsonPEEL0112", "bc1qjsonPEELCHG0113"], "input_amounts": [7.45915813], "output_amounts": [7.38889753, 0.06653102], "geo_country": "IN", "asn": 64500}, {"timestamp": "2026-08-03T09:35:00Z", "src_ip": "198.51.100.63", "dst_ip": "198.51.100.144", "src_port": 58593, "dst_port": 8332, "txid": "tx_json_0007", "input_addresses": ["bc1qjson0015"], "output_addresses": ["bc1qjson0016"], "input_amounts": [1.04704796], "output_amounts": [1.04640346], "geo_country": "DE", "asn": 64503}, {"timestamp": "2026-08-06T12:19:00Z", "src_ip": "198.51.100.173", "dst_ip": "198.51.100.81", "src_port": 32076, "dst_port": 8333, "txid": "tx_json_0047", "input_addresses": ["bc1qjsonBURST0140"], "output_addresses": ["bc1qjsonBURSTOUT0142"], "input_amounts": [0.52708921], "output_amounts": [0.52682567], "geo_country": "NL", "asn": 64501}, {"timestamp": "2026-08-06T12:23:00Z", "src_ip": "198.51.100.173", "dst_ip": "198.51.100.15", "src_port": 28682, "dst_port": 8333, "txid": "tx_json_0049", "input_addresses": ["bc1qjsonBURST0140"], "output_addresses": ["bc1qjsonBURSTOUT0144"], "input_amounts": [0.41869325], "output_amounts": [0.4184839], "geo_country": "NL", "asn": 64503}, {"timestamp": "2026-08-06T12:17:00Z", "src_ip": "198.51.100.173", "dst_ip": "198.51.100.10", "src_port": 40891, "dst_port": 8333, "txid": "tx_json_0046", "input_addresses": ["bc1qjsonBURST0140"], "output_addresses": ["bc1qjsonBURSTOUT0141"], "input_amounts": [0.34300089], "output_amounts": [0.34282939], "geo_country": "IN", "asn": 64500}, {"timestamp": "2026-08-06T12:21:00Z", "src_ip": "198.51.100.173", "dst_ip": "198.51.100.112", "src_port": 41468, "dst_port": 8333, "txid": "tx_json_0048", "input_addresses": ["bc1qjsonBURST0140"], "output_addresses": ["bc1qjsonBURSTOUT0143"], "input_amounts": [0.31980138], "output_amounts": [0.31964148], "geo_country": "NL", "asn": 64503}, {"timestamp": "2026-08-06T02:22:00Z", "src_ip": "198.51.100.8", "dst_ip": "198.51.100.36", "src_port": 60030, "dst_port": 8333, "txid": "tx_json_0041", "input_addresses": ["bc1qjsonCJ0124", "bc1qjsonCJ0125", "bc1qjsonCJ0126", "bc1qjsonCJ0127", "bc1qjsonCJ0128"], "output_addresses": ["bc1qjsonCJ0129", "bc1qjsonCJ0130", "bc1qjsonCJ0131", "bc1qjsonCJ0132", "bc1qjsonCJ0133"], "input_amounts": [0.2325892, 0.23225692, 0.23149124, 0.23217444, 0.23298272], "output_amounts": [0.23179246, 0.23179246, 0.23179246, 0.23179246, 0.23179246], "geo_country": "US", "asn": 64502}, {"timestamp": "2026-08-03T05:20:00Z", "src_ip": "198.51.100.99", "dst_ip": "198.51.100.68", "src_port": 1785, "dst_port": 8333, "txid": "tx_json_0004", "input_addresses": ["bc1qjson0009"], "output_addresses": ["bc1qjson0010"], "input_amounts": [0.5491095], "output_amounts": [0.54903191], "geo_country": "US", "asn": 64500}, {"timestamp": "2026-08-04T00:37:00Z", "src_ip": "198.51.100.41", "dst_ip": "198.51.100.65", "src_port": 13506, "dst_port": 8333, "txid": "tx_json_0015", "input_addresses": ["bc1qjson0038", "bc1qjson0039"], "output_addresses": ["bc1qjson0040", "bc1qjson0041"], "input_amounts": [1.02271546, 0.75663004], "output_amounts": [0.99180869, 0.78595964], "geo_country": "SG", "asn": 64502}, {"timestamp": "2026-08-05T14:15:00Z", "src_ip": "198.51.100.244", "dst_ip": "198.51.100.95", "src_port": 59532, "dst_port": 18333, "txid": "tx_json_0032", "input_addresses": ["bc1qjsonMI0088", "bc1qjsonMI0089", "bc1qjsonMI0090", "bc1qjsonMI0091"], "output_addresses": ["bc1qjson0092"], "input_amounts": [0.8448172, 0.94795884, 1.01187865, 0.48291878], "output_amounts": [3.28581121], "geo_country": "US", "asn": 64500}, {"timestamp": "2026-08-04T10:22:00Z", "src_ip": "198.51.100.52", "dst_ip": "198.51.100.79", "src_port": 13887, "dst_port": 8333, "txid": "tx_json_0019", "input_addresses": ["bc1qjson0052", "bc1qjson0053"], "output_addresses": ["bc1qjson0054"], "input_amounts": [0.46294231, 1.86860691], "output_amounts": [2.32988189], "geo_country": "RU", "asn": 64501}, {"timestamp": "2026-08-03T08:50:00Z", "src_ip": "198.51.100.198", "dst_ip": "198.51.100.16", "src_port": 41215, "dst_port": 8333, "txid": "tx_json_0006", "input_addresses": ["bc1qjson0013"], "output_addresses": ["bc1qjson0014"], "input_amounts": [0.60447564], "output_amounts": [0.60423217], "geo_country": "SG", "asn": 64501}, {"timestamp": "2026-08-03T12:30:00Z", "src_ip": "198.51.100.250", "dst_ip": "198.51.100.131", "src_port": 26577, "dst_port": 18333, "txid": "tx_json_0008", "input_addresses": ["bc1qjson0017"], "output_addresses": ["bc1qjson0018"], "input_amounts": [1.9466854], "output_amounts": [1.94546184], "geo_country": "IN", "asn": 64500}, {"timestamp": "2026-08-05T06:39:00Z", "src_ip": "198.51.100.25", "dst_ip": "198.51.100.129", "src_port": 5956, "dst_port": 8333, "txid": "tx_json_0028", "input_addresses": ["bc1qjson0076"], "output_addresses": ["bc1qjson0077", "bc1qjson0078"], "input_amounts": [0.50313505], "output_amounts": [0.24460425, 0.25821581], "geo_country": "IN", "asn": 64500}, {"timestamp": "2026-08-06T10:24:00Z", "src_ip": "198.51.100.143", "dst_ip": "198.51.100.100", "src_port": 29783, "dst_port": 8333, "txid": "tx_json_0044", "input_addresses": ["bc1qjsonHV0137"], "output_addresses": ["bc1qjsonHV0138"], "input_amounts": [118.18954284], "output_amounts": [118.15408598], "geo_country": "IN", "asn": 64503}, {"timestamp": "2026-08-04T13:56:00Z", "src_ip": "198.51.100.143", "dst_ip": "198.51.100.111", "src_port": 22358, "dst_port": 8333, "txid": "tx_json_0022", "input_addresses": ["bc1qjson0060"], "output_addresses": ["bc1qjson0061", "bc1qjson0062"], "input_amounts": [1.14800107], "output_amounts": [0.75746212, 0.39004528], "geo_country": "US", "asn": 64502}, {"timestamp": "2026-08-03T02:48:00Z", "src_ip": "198.51.100.224", "dst_ip": "198.51.100.104", "src_port": 22439, "dst_port": 8332, "txid": "tx_json_0002", "input_addresses": ["bc1qjson0004", "bc1qjson0005"], "output_addresses": ["bc1qjson0006"], "input_amounts": [0.41109089, 0.99358939], "output_amounts": [1.40376706], "geo_country": "RU", "asn": 64504}, {"timestamp": "2026-08-05T03:00:00Z", "src_ip": "198.51.100.172", "dst_ip": "198.51.100.180", "src_port": 12510, "dst_port": 18333, "txid": "tx_json_0027", "input_addresses": ["bc1qjson0073"], "output_addresses": ["bc1qjson0074", "bc1qjson0075"], "input_amounts": [1.07332608], "output_amounts": [0.13845222, 0.93469109], "geo_country": "US", "asn": 64501}, {"timestamp": "2026-08-06T06:42:00Z", "src_ip": "198.51.100.50", "dst_ip": "198.51.100.27", "src_port": 18378, "dst_port": 8333, "txid": "tx_json_0043", "input_addresses": ["bc1qjsonHV0135"], "output_addresses": ["bc1qjsonHV0136"], "input_amounts": [121.20226993], "output_amounts": [121.16590925], "geo_country": "NL", "asn": 64504}, {"timestamp": "2026-08-03T20:14:00Z", "src_ip": "198.51.100.107", "dst_ip": "198.51.100.121", "src_port": 64056, "dst_port": 8333, "txid": "tx_json_0012", "input_addresses": ["bc1qjson0029", "bc1qjson0030"], "output_addresses": ["bc1qjson0031"], "input_amounts": [0.99764603, 0.02251559], "output_amounts": [1.01988077], "geo_country": "RU", "asn": 64500}, {"timestamp": "2026-08-04T15:56:00Z", "src_ip": "198.51.100.237", "dst_ip": "198.51.100.163", "src_port": 49612, "dst_port": 8333, "txid": "tx_json_0023", "input_addresses": ["bc1qjson0063", "bc1qjson0064"], "output_addresses": ["bc1qjson0065"], "input_amounts": [0.5287944, 1.50395505], "output_amounts": [2.03133193], "geo_country": "SG", "asn": 64502}, {"timestamp": "2026-08-05T20:50:00Z", "src_ip": "198.51.100.21", "dst_ip": "198.51.100.20", "src_port": 39630, "dst_port": 8333, "txid": "tx_json_0038", "input_addresses": ["bc1qjsonPEEL0108"], "output_addresses": ["bc1qjsonPEEL0110", "bc1qjsonPEELCHG0111"], "input_amounts": [7.61837601], "output_amounts": [7.45915813, 0.15540869], "geo_country": "IN", "asn": 64500}, {"timestamp": "2026-08-04T12:44:00Z", "src_ip": "198.51.100.37", "dst_ip": "198.51.100.151", "src_port": 6110, "dst_port": 8332, "txid": "tx_json_0021", "input_addresses": ["bc1qjson0057", "bc1qjson0058"], "output_addresses": ["bc1qjson0059"], "input_amounts": [0.03855196, 0.08667069], "output_amounts": [0.12511278], "geo_country": "RU", "asn": 64503}, {"timestamp": "2026-08-06T12:25:00Z", "src_ip": "198.51.100.173", "dst_ip": "198.51.100.45", "src_port": 24790, "dst_port": 8333, "txid": "tx_json_0050", "input_addresses": ["bc1qjsonBURST0140"], "output_addresses": ["bc1qjsonBURSTOUT0145"], "input_amounts": [0.24704024], "output_amounts": [0.24691672], "geo_country": "US", "asn": 64502}, {"timestamp": "2026-08-05T12:05:00Z", "src_ip": "198.51.100.89", "dst_ip": "198.51.100.216", "src_port": 11183, "dst_port": 8333, "txid": "tx_json_0030", "input_addresses": ["bc1qjson0082", "bc1qjson0083"], "output_addresses": ["bc1qjson0084"], "input_amounts": [0.13403746, 0.69143932], "output_amounts": [0.82506984], "geo_country": "NL", "asn": 64501}, {"timestamp": "2026-08-04T21:24:00Z", "src_ip": "198.51.100.81", "dst_ip": "198.51.100.53", "src_port": 24964, "dst_port": 18333, "txid": "tx_json_0025", "input_addresses": ["bc1qjson0068"], "output_addresses": ["bc1qjson0069", "bc1qjson0070"], "input_amounts": [0.43890593], "output_amounts": [0.28654507, 0.15229165], "geo_country": "NL", "asn": 64501}],
    seeds: [{"address": "bc1qjsonSEED9999", "entity_name": "Known-High-Risk-Service-1", "entity_type": "illicit_service", "risk_score": 1.0, "label_confidence": 0.95, "source": "supplied_analyst_dataset", "first_flagged_txid": "tx_json_0042"}]
  },
  csv: {
    raw: "timestamp,src_ip,dst_ip,src_port,dst_port,txid,input_addresses,output_addresses,input_amounts,output_amounts,geo_country,asn\n2026-08-02T21:32:00Z,192.0.2.10,192.0.2.149,23684,18333,tx_csv_0008,bc1qcsv0018,bc1qcsv0019,1.38524976,1.38425915,IN,64500\n2026-08-04T14:05:00Z,192.0.2.153,192.0.2.212,44423,18333,tx_csv_0031,bc1qcsv0075,bc1qcsv0076,1.05611177,1.05597433,SG,64501\n2026-08-05T12:49:00Z,192.0.2.50,192.0.2.213,32239,8333,tx_csv_0045,bc1qcsvSEEDIN0133,bc1qcsvSEED9999,1.26191577,1.261411,US,64500\n2026-08-05T14:01:00Z,192.0.2.32,192.0.2.147,17461,8333,tx_csv_0048,bc1qcsvBURST0134,bc1qcsvBURSTOUT0137,0.22382497,0.22371306,DE,64500\n2026-08-03T02:34:00Z,192.0.2.136,192.0.2.206,60075,8332,tx_csv_0012,bc1qcsv0028,bc1qcsv0029,1.87514638,1.87453693,US,64503\n2026-08-04T17:48:00Z,192.0.2.34,192.0.2.127,26679,8333,tx_csv_0033,bc1qcsvMI0083|bc1qcsvMI0084|bc1qcsvMI0085|bc1qcsvMI0086|bc1qcsvMI0087,bc1qcsv0088,0.08051458|0.74949139|1.45730045|1.28566676|0.60722506,4.17844849,US,64500\n2026-08-05T03:27:00Z,192.0.2.99,192.0.2.44,50969,8333,tx_csv_0040,bc1qcsvCJ0108|bc1qcsvCJ0109|bc1qcsvCJ0110|bc1qcsvCJ0111|bc1qcsvCJ0112,bc1qcsvCJ0113|bc1qcsvCJ0114|bc1qcsvCJ0115|bc1qcsvCJ0116|bc1qcsvCJ0117,0.25568074|0.25540114|0.25643298|0.25456047|0.25579196,0.25523798|0.25523798|0.25523798|0.25523798|0.25523798,DE,64502\n2026-08-02T15:26:00Z,192.0.2.18,192.0.2.112,31676,8332,tx_csv_0003,bc1qcsv0006,bc1qcsv0007,1.57469317,1.57419724,SG,64503\n2026-08-03T12:00:00Z,192.0.2.118,192.0.2.78,50264,8333,tx_csv_0018,bc1qcsv0043,bc1qcsv0044,1.35504746,1.35401587,US,64503\n2026-08-05T14:05:00Z,192.0.2.32,192.0.2.186,57617,8333,tx_csv_0050,bc1qcsvBURST0134,bc1qcsvBURSTOUT0139,0.26178559,0.2616547,US,64501\n2026-08-04T03:59:00Z,192.0.2.225,192.0.2.158,40508,8333,tx_csv_0026,bc1qcsv0063,bc1qcsv0064,0.22986676,0.22983531,NL,64504\n2026-08-04T16:06:00Z,192.0.2.173,192.0.2.79,7019,8333,tx_csv_0032,bc1qcsvMI0077|bc1qcsvMI0078|bc1qcsvMI0079|bc1qcsvMI0080|bc1qcsvMI0081,bc1qcsv0082,1.42554365|0.94426361|1.17366207|1.35649887|0.71426208,5.60895092,DE,64500\n2026-08-03T20:56:00Z,192.0.2.37,192.0.2.11,13428,18333,tx_csv_0024,bc1qcsv0057,bc1qcsv0058,1.46269689,1.46177744,RU,64501\n2026-08-04T21:04:00Z,192.0.2.15,192.0.2.137,8058,18333,tx_csv_0035,bc1qcsvMI0095|bc1qcsvMI0096|bc1qcsvMI0097,bc1qcsv0098,1.14890542|0.79868523|0.7574947,2.70257573,SG,64504\n2026-08-02T14:28:00Z,192.0.2.115,192.0.2.199,36238,8332,tx_csv_0002,bc1qcsv0004,bc1qcsv0005,1.94250084,1.94218359,US,64501\n2026-08-04T09:37:00Z,192.0.2.106,192.0.2.40,40233,8333,tx_csv_0029,bc1qcsv0069|bc1qcsv0070,bc1qcsv0071|bc1qcsv0072,0.6717474|0.07451701,0.64008317|0.10590182,SG,64501\n2026-08-05T10:21:00Z,192.0.2.146,192.0.2.189,46237,8333,tx_csv_0044,bc1qcsvHV0131,bc1qcsvHV0132,102.91155917,102.8806857,NL,64501\n2026-08-05T14:03:00Z,192.0.2.32,192.0.2.84,3479,8333,tx_csv_0049,bc1qcsvBURST0134,bc1qcsvBURSTOUT0138,0.27166514,0.27152931,IN,64500\n2026-08-04T23:50:00Z,192.0.2.194,192.0.2.180,30036,8333,tx_csv_0039,bc1qcsvPEEL0104,bc1qcsvPEEL0106|bc1qcsvPEELCHG0107,10.35906241,10.11062372|0.24325916,IN,64500\n2026-08-02T21:11:00Z,192.0.2.129,192.0.2.218,58427,18333,tx_csv_0007,bc1qcsv0015,bc1qcsv0016|bc1qcsv0017,1.98187534,1.69658451|0.28361553,NL,64503\n2026-08-03T00:59:00Z,192.0.2.165,192.0.2.37,45966,8333,tx_csv_0009,bc1qcsv0020|bc1qcsv0021,bc1qcsv0022,1.67876552|0.24655541,1.92390553,NL,64503\n2026-08-02T20:24:00Z,192.0.2.73,192.0.2.18,51067,8333,tx_csv_0006,bc1qcsv0012,bc1qcsv0013|bc1qcsv0014,0.72562881,0.57119897|0.15418613,IN,64503\n2026-08-03T05:36:00Z,192.0.2.52,192.0.2.143,39894,18333,tx_csv_0014,bc1qcsv0032,bc1qcsv0033|bc1qcsv0034,1.14305637,0.30228435|0.83983032,DE,64503\n2026-08-03T11:03:00Z,192.0.2.34,192.0.2.119,36796,18333,tx_csv_0017,bc1qcsv0040,bc1qcsv0041|bc1qcsv0042,1.34585643,0.68828842|0.65643625,RU,64504\n2026-08-02T17:12:00Z,192.0.2.202,192.0.2.99,16039,8332,tx_csv_0004,bc1qcsv0008,bc1qcsv0009,1.30803283,1.30716636,DE,64502\n2026-08-05T13:59:00Z,192.0.2.32,192.0.2.125,52972,8333,tx_csv_0047,bc1qcsvBURST0134,bc1qcsvBURSTOUT0136,0.27426319,0.27412606,SG,64503\n2026-08-02T14:01:00Z,192.0.2.236,192.0.2.75,32839,18333,tx_csv_0001,bc1qcsv0001,bc1qcsv0002|bc1qcsv0003,1.84871304,1.19572319|0.65202773,US,64504\n2026-08-05T07:18:00Z,192.0.2.5,192.0.2.45,17759,8333,tx_csv_0042,bc1qcsvHV0128,bc1qcsvSEED9999,55.45004634,55.43341133,RU,64504\n2026-08-02T19:33:00Z,192.0.2.26,192.0.2.90,53164,8333,tx_csv_0005,bc1qcsv0010,bc1qcsv0011,1.49149334,1.49078251,SG,64501\n2026-08-04T12:55:00Z,192.0.2.234,192.0.2.50,22599,8333,tx_csv_0030,bc1qcsv0073,bc1qcsv0074,0.97896641,0.97869784,DE,64500\n2026-08-05T07:55:00Z,192.0.2.145,192.0.2.186,19851,8333,tx_csv_0043,bc1qcsvHV0129,bc1qcsvHV0130,132.02097171,131.98136542,US,64504\n2026-08-03T02:01:00Z,192.0.2.51,192.0.2.73,45527,8332,tx_csv_0011,bc1qcsv0026,bc1qcsv0027,1.1015882,1.10079474,DE,64503\n2026-08-04T08:41:00Z,192.0.2.40,192.0.2.205,56943,18333,tx_csv_0028,bc1qcsv0067,bc1qcsv0068,0.33990162,0.33961436,RU,64504\n2026-08-04T20:48:00Z,192.0.2.154,192.0.2.74,56970,8332,tx_csv_0034,bc1qcsvMI0089|bc1qcsvMI0090|bc1qcsvMI0091|bc1qcsvMI0092|bc1qcsvMI0093,bc1qcsv0094,0.32019287|1.04713048|1.20306414|1.10404614|0.44099436,4.11142049,RU,64501\n2026-08-04T21:43:00Z,192.0.2.194,192.0.2.180,42027,8333,tx_csv_0036,bc1qcsvPEEL0099,bc1qcsvPEEL0100|bc1qcsvPEELCHG0101,10.83199754,10.65410546|0.17247609,IN,64500\n2026-08-03T14:55:00Z,192.0.2.15,192.0.2.70,37248,18333,tx_csv_0019,bc1qcsv0045,bc1qcsv0046,1.16055703,1.16008311,SG,64503\n2026-08-03T15:03:00Z,192.0.2.107,192.0.2.239,30651,18333,tx_csv_0020,bc1qcsv0047,bc1qcsv0048,1.54869823,1.54789501,NL,64500\n2026-08-04T22:11:00Z,192.0.2.194,192.0.2.180,9964,8333,tx_csv_0037,bc1qcsvPEEL0100,bc1qcsvPEEL0102|bc1qcsvPEELCHG0103,10.65410546,10.50555283|0.14322558,IN,64500\n2026-08-03T09:29:00Z,192.0.2.105,192.0.2.104,42859,8333,tx_csv_0015,bc1qcsv0035,bc1qcsv0036,0.04685789,0.04684756,DE,64502\n2026-08-05T13:57:00Z,192.0.2.32,192.0.2.49,10232,8333,tx_csv_0046,bc1qcsvBURST0134,bc1qcsvBURSTOUT0135,0.2589766,0.25884711,SG,64502\n2026-08-04T00:52:00Z,192.0.2.34,192.0.2.149,44262,8332,tx_csv_0025,bc1qcsv0059|bc1qcsv0060,bc1qcsv0061|bc1qcsv0062,1.02728497|0.46130252,1.32588301|0.16176161,DE,64504\n2026-08-03T18:57:00Z,192.0.2.61,192.0.2.189,13625,18333,tx_csv_0023,bc1qcsv0055,bc1qcsv0056,0.53770759,0.5375384,US,64504\n2026-08-03T18:28:00Z,192.0.2.20,192.0.2.39,31797,18333,tx_csv_0022,bc1qcsv0052|bc1qcsv0053,bc1qcsv0054,1.38550202|1.95360055,3.33637031,DE,64504\n2026-08-04T22:51:00Z,192.0.2.194,192.0.2.180,16922,8333,tx_csv_0038,bc1qcsvPEEL0102,bc1qcsvPEEL0104|bc1qcsvPEELCHG0105,10.50555283,10.35906241|0.14123764,IN,64500\n2026-08-03T01:42:00Z,192.0.2.228,192.0.2.81,23146,8332,tx_csv_0010,bc1qcsv0023,bc1qcsv0024|bc1qcsv0025,1.86650991,1.73033478|0.13506903,US,64500\n2026-08-03T15:17:00Z,192.0.2.179,192.0.2.224,18455,18333,tx_csv_0021,bc1qcsv0049,bc1qcsv0050|bc1qcsv0051,1.90927478,1.47842034|0.429826,RU,64500\n2026-08-03T02:42:00Z,192.0.2.164,192.0.2.103,57169,18333,tx_csv_0013,bc1qcsv0030,bc1qcsv0031,0.56838416,0.56782743,US,64500\n2026-08-05T06:47:00Z,192.0.2.46,192.0.2.235,46548,8333,tx_csv_0041,bc1qcsvCJ0118|bc1qcsvCJ0119|bc1qcsvCJ0120|bc1qcsvCJ0121|bc1qcsvCJ0122,bc1qcsvCJ0123|bc1qcsvCJ0124|bc1qcsvCJ0125|bc1qcsvCJ0126|bc1qcsvCJ0127,0.3213654|0.3224094|0.32289798|0.32197558|0.32243015,0.32169802|0.32169802|0.32169802|0.32169802|0.32169802,SG,64503\n2026-08-03T10:05:00Z,192.0.2.96,192.0.2.8,30343,18333,tx_csv_0016,bc1qcsv0037|bc1qcsv0038,bc1qcsv0039,1.03754346|0.44013354,1.47664494,US,64502\n2026-08-04T06:59:00Z,192.0.2.137,192.0.2.17,7334,8332,tx_csv_0027,bc1qcsv0065,bc1qcsv0066,1.51023726,1.50913475,IN,64502\n",
    seeds: [{"address": "bc1qcsvSEED9999", "entity_name": "Known-High-Risk-Service-1", "entity_type": "illicit_service", "risk_score": 1.0, "label_confidence": 0.95, "source": "supplied_analyst_dataset", "first_flagged_txid": "tx_csv_0042"}]
  },
  xml: {
    raw: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<transactions>\n  <transaction txid=\"tx_xml_0015\">\n    <timestamp>2026-08-02T17:31:00Z</timestamp>\n    <src_ip>203.0.113.212</src_ip>\n    <dst_ip>203.0.113.8</dst_ip>\n    <src_port>11229</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"1.02236262\">bc1qxml0039</address>\n      <address amount=\"1.10799364\">bc1qxml0040</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"2.12952906\">bc1qxml0041</address>\n    </output_addresses>\n    <geo_country>SG</geo_country>\n    <asn>64504</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0027\">\n    <timestamp>2026-08-03T20:49:00Z</timestamp>\n    <src_ip>203.0.113.119</src_ip>\n    <dst_ip>203.0.113.42</dst_ip>\n    <src_port>58573</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"0.73341699\">bc1qxml0073</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.73310713\">bc1qxml0074</address>\n    </output_addresses>\n    <geo_country>DE</geo_country>\n    <asn>64502</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0022\">\n    <timestamp>2026-08-03T11:24:00Z</timestamp>\n    <src_ip>203.0.113.70</src_ip>\n    <dst_ip>203.0.113.119</dst_ip>\n    <src_port>9338</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"1.14252533\">bc1qxml0059</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.14198001\">bc1qxml0060</address>\n    </output_addresses>\n    <geo_country>IN</geo_country>\n    <asn>64500</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0049\">\n    <timestamp>2026-08-05T04:40:00Z</timestamp>\n    <src_ip>203.0.113.246</src_ip>\n    <dst_ip>203.0.113.239</dst_ip>\n    <src_port>63285</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"0.5866239\">bc1qxmlBURST0150</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.58633059\">bc1qxmlBURSTOUT0154</address>\n    </output_addresses>\n    <geo_country>RU</geo_country>\n    <asn>64501</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0038\">\n    <timestamp>2026-08-04T14:40:00Z</timestamp>\n    <src_ip>203.0.113.87</src_ip>\n    <dst_ip>203.0.113.56</dst_ip>\n    <src_port>49320</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"8.52757858\">bc1qxmlPEEL0112</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"8.30511887\">bc1qxmlPEEL0114</address>\n      <address amount=\"0.21819592\">bc1qxmlPEELCHG0115</address>\n    </output_addresses>\n    <geo_country>IN</geo_country>\n    <asn>64500</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0029\">\n    <timestamp>2026-08-04T02:12:00Z</timestamp>\n    <src_ip>203.0.113.227</src_ip>\n    <dst_ip>203.0.113.206</dst_ip>\n    <src_port>54388</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"1.26891586\">bc1qxml0079</address>\n      <address amount=\"1.18898421\">bc1qxml0080</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"2.45547306\">bc1qxml0081</address>\n    </output_addresses>\n    <geo_country>IN</geo_country>\n    <asn>64503</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0016\">\n    <timestamp>2026-08-02T20:59:00Z</timestamp>\n    <src_ip>203.0.113.51</src_ip>\n    <dst_ip>203.0.113.222</dst_ip>\n    <src_port>57026</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"1.54540394\">bc1qxml0042</address>\n      <address amount=\"1.6552166\">bc1qxml0043</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.89006636\">bc1qxml0044</address>\n      <address amount=\"1.30835099\">bc1qxml0045</address>\n    </output_addresses>\n    <geo_country>SG</geo_country>\n    <asn>64503</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0033\">\n    <timestamp>2026-08-04T07:49:00Z</timestamp>\n    <src_ip>203.0.113.208</src_ip>\n    <dst_ip>203.0.113.14</dst_ip>\n    <src_port>37701</src_port>\n    <dst_port>18333</dst_port>\n    <input_addresses>\n      <address amount=\"1.45599086\">bc1qxmlMI0093</address>\n      <address amount=\"0.13698576\">bc1qxmlMI0094</address>\n      <address amount=\"0.50768351\">bc1qxmlMI0095</address>\n      <address amount=\"0.60384914\">bc1qxmlMI0096</address>\n      <address amount=\"0.72119161\">bc1qxmlMI0097</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"3.4245591\">bc1qxml0098</address>\n    </output_addresses>\n    <geo_country>US</geo_country>\n    <asn>64502</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0032\">\n    <timestamp>2026-08-04T06:58:00Z</timestamp>\n    <src_ip>203.0.113.241</src_ip>\n    <dst_ip>203.0.113.119</dst_ip>\n    <src_port>57966</src_port>\n    <dst_port>8332</dst_port>\n    <input_addresses>\n      <address amount=\"0.29651239\">bc1qxmlMI0089</address>\n      <address amount=\"0.74708506\">bc1qxmlMI0090</address>\n      <address amount=\"0.91203321\">bc1qxmlMI0091</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.95493124\">bc1qxml0092</address>\n    </output_addresses>\n    <geo_country>RU</geo_country>\n    <asn>64501</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0035\">\n    <timestamp>2026-08-04T12:35:00Z</timestamp>\n    <src_ip>203.0.113.145</src_ip>\n    <dst_ip>203.0.113.153</dst_ip>\n    <src_port>40164</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"1.1410463\">bc1qxmlMI0103</address>\n      <address amount=\"0.41346555\">bc1qxmlMI0104</address>\n      <address amount=\"0.16535751\">bc1qxmlMI0105</address>\n      <address amount=\"0.09428167\">bc1qxmlMI0106</address>\n      <address amount=\"0.67314285\">bc1qxmlMI0107</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"2.48603799\">bc1qxml0108</address>\n    </output_addresses>\n    <geo_country>US</geo_country>\n    <asn>64503</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0019\">\n    <timestamp>2026-08-03T05:22:00Z</timestamp>\n    <src_ip>203.0.113.144</src_ip>\n    <dst_ip>203.0.113.189</dst_ip>\n    <src_port>36950</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"0.15096355\">bc1qxml0051</address>\n      <address amount=\"0.10468993\">bc1qxml0052</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.25557359\">bc1qxml0053</address>\n    </output_addresses>\n    <geo_country>DE</geo_country>\n    <asn>64503</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0047\">\n    <timestamp>2026-08-05T04:36:00Z</timestamp>\n    <src_ip>203.0.113.246</src_ip>\n    <dst_ip>203.0.113.6</dst_ip>\n    <src_port>42726</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"0.52381713\">bc1qxmlBURST0150</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.52355522\">bc1qxmlBURSTOUT0152</address>\n    </output_addresses>\n    <geo_country>DE</geo_country>\n    <asn>64501</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0002\">\n    <timestamp>2026-08-01T07:19:00Z</timestamp>\n    <src_ip>203.0.113.102</src_ip>\n    <dst_ip>203.0.113.37</dst_ip>\n    <src_port>33325</src_port>\n    <dst_port>8332</dst_port>\n    <input_addresses>\n      <address amount=\"0.52051345\">bc1qxml0004</address>\n      <address amount=\"1.09238601\">bc1qxml0005</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.61174235\">bc1qxml0006</address>\n    </output_addresses>\n    <geo_country>NL</geo_country>\n    <asn>64500</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0046\">\n    <timestamp>2026-08-05T04:34:00Z</timestamp>\n    <src_ip>203.0.113.246</src_ip>\n    <dst_ip>203.0.113.220</dst_ip>\n    <src_port>35745</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"0.53846885\">bc1qxmlBURST0150</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.53819962\">bc1qxmlBURSTOUT0151</address>\n    </output_addresses>\n    <geo_country>IN</geo_country>\n    <asn>64504</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0026\">\n    <timestamp>2026-08-03T19:14:00Z</timestamp>\n    <src_ip>203.0.113.231</src_ip>\n    <dst_ip>203.0.113.164</dst_ip>\n    <src_port>56686</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"1.62468157\">bc1qxml0070</address>\n      <address amount=\"0.37984902\">bc1qxml0071</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"2.00289549\">bc1qxml0072</address>\n    </output_addresses>\n    <geo_country>SG</geo_country>\n    <asn>64503</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0025\">\n    <timestamp>2026-08-03T15:54:00Z</timestamp>\n    <src_ip>203.0.113.146</src_ip>\n    <dst_ip>203.0.113.80</dst_ip>\n    <src_port>65371</src_port>\n    <dst_port>8332</dst_port>\n    <input_addresses>\n      <address amount=\"1.9776003\">bc1qxml0066</address>\n      <address amount=\"0.43852118\">bc1qxml0067</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"2.13105265\">bc1qxml0068</address>\n      <address amount=\"0.28461535\">bc1qxml0069</address>\n    </output_addresses>\n    <geo_country>DE</geo_country>\n    <asn>64504</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0003\">\n    <timestamp>2026-08-01T08:50:00Z</timestamp>\n    <src_ip>203.0.113.40</src_ip>\n    <dst_ip>203.0.113.42</dst_ip>\n    <src_port>14655</src_port>\n    <dst_port>18333</dst_port>\n    <input_addresses>\n      <address amount=\"1.35289907\">bc1qxml0007</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.21023402\">bc1qxml0008</address>\n      <address amount=\"0.1421886\">bc1qxml0009</address>\n    </output_addresses>\n    <geo_country>US</geo_country>\n    <asn>64501</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0028\">\n    <timestamp>2026-08-03T22:22:00Z</timestamp>\n    <src_ip>203.0.113.241</src_ip>\n    <dst_ip>203.0.113.70</dst_ip>\n    <src_port>58468</src_port>\n    <dst_port>18333</dst_port>\n    <input_addresses>\n      <address amount=\"0.72853499\">bc1qxml0075</address>\n      <address amount=\"0.70986141\">bc1qxml0076</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.56681846\">bc1qxml0077</address>\n      <address amount=\"0.87037052\">bc1qxml0078</address>\n    </output_addresses>\n    <geo_country>DE</geo_country>\n    <asn>64500</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0009\">\n    <timestamp>2026-08-02T02:06:00Z</timestamp>\n    <src_ip>203.0.113.98</src_ip>\n    <dst_ip>203.0.113.12</dst_ip>\n    <src_port>33451</src_port>\n    <dst_port>18333</dst_port>\n    <input_addresses>\n      <address amount=\"1.43182107\">bc1qxml0022</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.39805196\">bc1qxml0023</address>\n      <address amount=\"1.03354468\">bc1qxml0024</address>\n    </output_addresses>\n    <geo_country>NL</geo_country>\n    <asn>64501</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0005\">\n    <timestamp>2026-08-01T15:08:00Z</timestamp>\n    <src_ip>203.0.113.216</src_ip>\n    <dst_ip>203.0.113.188</dst_ip>\n    <src_port>24120</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"1.76826531\">bc1qxml0012</address>\n      <address amount=\"1.75576212\">bc1qxml0013</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"3.52127468\">bc1qxml0014</address>\n    </output_addresses>\n    <geo_country>RU</geo_country>\n    <asn>64501</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0021\">\n    <timestamp>2026-08-03T10:49:00Z</timestamp>\n    <src_ip>203.0.113.47</src_ip>\n    <dst_ip>203.0.113.31</dst_ip>\n    <src_port>62368</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"0.29404586\">bc1qxml0056</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.15262178\">bc1qxml0057</address>\n      <address amount=\"0.14119254\">bc1qxml0058</address>\n    </output_addresses>\n    <geo_country>IN</geo_country>\n    <asn>64500</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0044\">\n    <timestamp>2026-08-05T03:06:00Z</timestamp>\n    <src_ip>203.0.113.77</src_ip>\n    <dst_ip>203.0.113.86</dst_ip>\n    <src_port>56010</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"66.46299709\">bc1qxmlHV0147</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"66.44305819\">bc1qxmlHV0148</address>\n    </output_addresses>\n    <geo_country>NL</geo_country>\n    <asn>64500</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0023\">\n    <timestamp>2026-08-03T12:32:00Z</timestamp>\n    <src_ip>203.0.113.117</src_ip>\n    <dst_ip>203.0.113.162</dst_ip>\n    <src_port>33125</src_port>\n    <dst_port>8332</dst_port>\n    <input_addresses>\n      <address amount=\"1.25672344\">bc1qxml0061</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.25624201\">bc1qxml0062</address>\n    </output_addresses>\n    <geo_country>NL</geo_country>\n    <asn>64502</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0036\">\n    <timestamp>2026-08-04T13:32:00Z</timestamp>\n    <src_ip>203.0.113.87</src_ip>\n    <dst_ip>203.0.113.56</dst_ip>\n    <src_port>41771</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"9.00250591\">bc1qxmlPEEL0109</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"8.73867134\">bc1qxmlPEEL0110</address>\n      <address amount=\"0.25933331\">bc1qxmlPEELCHG0111</address>\n    </output_addresses>\n    <geo_country>IN</geo_country>\n    <asn>64500</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0010\">\n    <timestamp>2026-08-02T03:05:00Z</timestamp>\n    <src_ip>203.0.113.134</src_ip>\n    <dst_ip>203.0.113.117</dst_ip>\n    <src_port>44960</src_port>\n    <dst_port>8332</dst_port>\n    <input_addresses>\n      <address amount=\"0.37722443\">bc1qxml0025</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.04273471\">bc1qxml0026</address>\n      <address amount=\"0.33425582\">bc1qxml0027</address>\n    </output_addresses>\n    <geo_country>SG</geo_country>\n    <asn>64501</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0040\">\n    <timestamp>2026-08-04T14:57:00Z</timestamp>\n    <src_ip>203.0.113.24</src_ip>\n    <dst_ip>203.0.113.207</dst_ip>\n    <src_port>46946</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"0.46186137\">bc1qxmlCJ0118</address>\n      <address amount=\"0.46168094\">bc1qxmlCJ0119</address>\n      <address amount=\"0.4619002\">bc1qxmlCJ0120</address>\n      <address amount=\"0.46048262\">bc1qxmlCJ0121</address>\n      <address amount=\"0.46111163\">bc1qxmlCJ0122</address>\n      <address amount=\"0.46142813\">bc1qxmlCJ0123</address>\n      <address amount=\"0.46093433\">bc1qxmlCJ0124</address>\n      <address amount=\"0.46196764\">bc1qxmlCJ0125</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.46116739\">bc1qxmlCJ0126</address>\n      <address amount=\"0.46116739\">bc1qxmlCJ0127</address>\n      <address amount=\"0.46116739\">bc1qxmlCJ0128</address>\n      <address amount=\"0.46116739\">bc1qxmlCJ0129</address>\n      <address amount=\"0.46116739\">bc1qxmlCJ0130</address>\n      <address amount=\"0.46116739\">bc1qxmlCJ0131</address>\n      <address amount=\"0.46116739\">bc1qxmlCJ0132</address>\n      <address amount=\"0.46116739\">bc1qxmlCJ0133</address>\n    </output_addresses>\n    <geo_country>DE</geo_country>\n    <asn>64503</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0018\">\n    <timestamp>2026-08-03T02:03:00Z</timestamp>\n    <src_ip>203.0.113.221</src_ip>\n    <dst_ip>203.0.113.89</dst_ip>\n    <src_port>37022</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"1.30729694\">bc1qxml0048</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.49168793\">bc1qxml0049</address>\n      <address amount=\"0.81488513\">bc1qxml0050</address>\n    </output_addresses>\n    <geo_country>US</geo_country>\n    <asn>64503</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0042\">\n    <timestamp>2026-08-04T20:06:00Z</timestamp>\n    <src_ip>203.0.113.77</src_ip>\n    <dst_ip>203.0.113.220</dst_ip>\n    <src_port>34900</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"101.55214033\">bc1qxmlHV0144</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"101.52167469\">bc1qxmlSEED9999</address>\n    </output_addresses>\n    <geo_country>US</geo_country>\n    <asn>64501</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0017\">\n    <timestamp>2026-08-02T22:25:00Z</timestamp>\n    <src_ip>203.0.113.33</src_ip>\n    <dst_ip>203.0.113.43</dst_ip>\n    <src_port>44732</src_port>\n    <dst_port>18333</dst_port>\n    <input_addresses>\n      <address amount=\"1.80585407\">bc1qxml0046</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.80427776\">bc1qxml0047</address>\n    </output_addresses>\n    <geo_country>US</geo_country>\n    <asn>64503</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0043\">\n    <timestamp>2026-08-04T23:41:00Z</timestamp>\n    <src_ip>203.0.113.90</src_ip>\n    <dst_ip>203.0.113.212</dst_ip>\n    <src_port>44137</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"97.21195325\">bc1qxmlHV0145</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"97.18278966\">bc1qxmlHV0146</address>\n    </output_addresses>\n    <geo_country>RU</geo_country>\n    <asn>64502</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0014\">\n    <timestamp>2026-08-02T13:31:00Z</timestamp>\n    <src_ip>203.0.113.209</src_ip>\n    <dst_ip>203.0.113.67</dst_ip>\n    <src_port>15508</src_port>\n    <dst_port>8332</dst_port>\n    <input_addresses>\n      <address amount=\"0.93380161\">bc1qxml0037</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.9330334\">bc1qxml0038</address>\n    </output_addresses>\n    <geo_country>IN</geo_country>\n    <asn>64504</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0001\">\n    <timestamp>2026-08-01T04:17:00Z</timestamp>\n    <src_ip>203.0.113.103</src_ip>\n    <dst_ip>203.0.113.42</dst_ip>\n    <src_port>27874</src_port>\n    <dst_port>8332</dst_port>\n    <input_addresses>\n      <address amount=\"0.39786213\">bc1qxml0001</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.35854209\">bc1qxml0002</address>\n      <address amount=\"0.03892418\">bc1qxml0003</address>\n    </output_addresses>\n    <geo_country>DE</geo_country>\n    <asn>64504</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0004\">\n    <timestamp>2026-08-01T11:42:00Z</timestamp>\n    <src_ip>203.0.113.237</src_ip>\n    <dst_ip>203.0.113.66</dst_ip>\n    <src_port>35469</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"1.40660951\">bc1qxml0010</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.40542165\">bc1qxml0011</address>\n    </output_addresses>\n    <geo_country>RU</geo_country>\n    <asn>64504</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0031\">\n    <timestamp>2026-08-04T04:26:00Z</timestamp>\n    <src_ip>203.0.113.54</src_ip>\n    <dst_ip>203.0.113.194</dst_ip>\n    <src_port>19776</src_port>\n    <dst_port>8332</dst_port>\n    <input_addresses>\n      <address amount=\"0.37227635\">bc1qxml0086</address>\n      <address amount=\"1.37134464\">bc1qxml0087</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.74264429\">bc1qxml0088</address>\n    </output_addresses>\n    <geo_country>IN</geo_country>\n    <asn>64501</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0013\">\n    <timestamp>2026-08-02T09:58:00Z</timestamp>\n    <src_ip>203.0.113.87</src_ip>\n    <dst_ip>203.0.113.168</dst_ip>\n    <src_port>63069</src_port>\n    <dst_port>18333</dst_port>\n    <input_addresses>\n      <address amount=\"0.17960598\">bc1qxml0033</address>\n      <address amount=\"1.3749612\">bc1qxml0034</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.18506996\">bc1qxml0035</address>\n      <address amount=\"0.36912407\">bc1qxml0036</address>\n    </output_addresses>\n    <geo_country>DE</geo_country>\n    <asn>64502</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0012\">\n    <timestamp>2026-08-02T07:09:00Z</timestamp>\n    <src_ip>203.0.113.83</src_ip>\n    <dst_ip>203.0.113.140</dst_ip>\n    <src_port>37486</src_port>\n    <dst_port>8332</dst_port>\n    <input_addresses>\n      <address amount=\"0.41105076\">bc1qxml0031</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.41067369\">bc1qxml0032</address>\n    </output_addresses>\n    <geo_country>RU</geo_country>\n    <asn>64501</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0006\">\n    <timestamp>2026-08-01T17:17:00Z</timestamp>\n    <src_ip>203.0.113.25</src_ip>\n    <dst_ip>203.0.113.48</dst_ip>\n    <src_port>63631</src_port>\n    <dst_port>8332</dst_port>\n    <input_addresses>\n      <address amount=\"0.34552668\">bc1qxml0015</address>\n      <address amount=\"1.95179548\">bc1qxml0016</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"2.29680206\">bc1qxml0017</address>\n    </output_addresses>\n    <geo_country>IN</geo_country>\n    <asn>64501</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0041\">\n    <timestamp>2026-08-04T17:52:00Z</timestamp>\n    <src_ip>203.0.113.235</src_ip>\n    <dst_ip>203.0.113.231</dst_ip>\n    <src_port>42141</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"0.32236676\">bc1qxmlCJ0134</address>\n      <address amount=\"0.32128409\">bc1qxmlCJ0135</address>\n      <address amount=\"0.32283696\">bc1qxmlCJ0136</address>\n      <address amount=\"0.32273347\">bc1qxmlCJ0137</address>\n      <address amount=\"0.32151681\">bc1qxmlCJ0138</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.32178755\">bc1qxmlCJ0139</address>\n      <address amount=\"0.32178755\">bc1qxmlCJ0140</address>\n      <address amount=\"0.32178755\">bc1qxmlCJ0141</address>\n      <address amount=\"0.32178755\">bc1qxmlCJ0142</address>\n      <address amount=\"0.32178755\">bc1qxmlCJ0143</address>\n    </output_addresses>\n    <geo_country>NL</geo_country>\n    <asn>64504</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0050\">\n    <timestamp>2026-08-05T04:42:00Z</timestamp>\n    <src_ip>203.0.113.246</src_ip>\n    <dst_ip>203.0.113.42</dst_ip>\n    <src_port>30750</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"0.31871209\">bc1qxmlBURST0150</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.31855273\">bc1qxmlBURSTOUT0155</address>\n    </output_addresses>\n    <geo_country>RU</geo_country>\n    <asn>64503</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0034\">\n    <timestamp>2026-08-04T10:22:00Z</timestamp>\n    <src_ip>203.0.113.21</src_ip>\n    <dst_ip>203.0.113.215</dst_ip>\n    <src_port>8872</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"1.28574234\">bc1qxmlMI0099</address>\n      <address amount=\"0.67953744\">bc1qxmlMI0100</address>\n      <address amount=\"0.10392924\">bc1qxmlMI0101</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"2.06822259\">bc1qxml0102</address>\n    </output_addresses>\n    <geo_country>IN</geo_country>\n    <asn>64500</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0007\">\n    <timestamp>2026-08-01T20:25:00Z</timestamp>\n    <src_ip>203.0.113.162</src_ip>\n    <dst_ip>203.0.113.20</dst_ip>\n    <src_port>47255</src_port>\n    <dst_port>8332</dst_port>\n    <input_addresses>\n      <address amount=\"1.89463201\">bc1qxml0018</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.8933525\">bc1qxml0019</address>\n    </output_addresses>\n    <geo_country>US</geo_country>\n    <asn>64501</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0011\">\n    <timestamp>2026-08-02T03:16:00Z</timestamp>\n    <src_ip>203.0.113.137</src_ip>\n    <dst_ip>203.0.113.204</dst_ip>\n    <src_port>20465</src_port>\n    <dst_port>8332</dst_port>\n    <input_addresses>\n      <address amount=\"1.73978673\">bc1qxml0028</address>\n      <address amount=\"0.08692113\">bc1qxml0029</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.82502829\">bc1qxml0030</address>\n    </output_addresses>\n    <geo_country>SG</geo_country>\n    <asn>64503</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0024\">\n    <timestamp>2026-08-03T13:13:00Z</timestamp>\n    <src_ip>203.0.113.31</src_ip>\n    <dst_ip>203.0.113.204</dst_ip>\n    <src_port>39756</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"1.2502018\">bc1qxml0063</address>\n      <address amount=\"0.05410226\">bc1qxml0064</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.30312903\">bc1qxml0065</address>\n    </output_addresses>\n    <geo_country>IN</geo_country>\n    <asn>64502</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0020\">\n    <timestamp>2026-08-03T08:38:00Z</timestamp>\n    <src_ip>203.0.113.196</src_ip>\n    <dst_ip>203.0.113.121</dst_ip>\n    <src_port>30819</src_port>\n    <dst_port>18333</dst_port>\n    <input_addresses>\n      <address amount=\"0.93269404\">bc1qxml0054</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.93195826\">bc1qxml0055</address>\n    </output_addresses>\n    <geo_country>US</geo_country>\n    <asn>64503</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0039\">\n    <timestamp>2026-08-04T14:51:00Z</timestamp>\n    <src_ip>203.0.113.87</src_ip>\n    <dst_ip>203.0.113.56</dst_ip>\n    <src_port>58059</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"8.30511887\">bc1qxmlPEEL0114</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"8.16721363\">bc1qxmlPEEL0116</address>\n      <address amount=\"0.13375268\">bc1qxmlPEELCHG0117</address>\n    </output_addresses>\n    <geo_country>IN</geo_country>\n    <asn>64500</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0008\">\n    <timestamp>2026-08-01T23:09:00Z</timestamp>\n    <src_ip>203.0.113.220</src_ip>\n    <dst_ip>203.0.113.133</dst_ip>\n    <src_port>42325</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"0.65502192\">bc1qxml0020</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.65485686\">bc1qxml0021</address>\n    </output_addresses>\n    <geo_country>US</geo_country>\n    <asn>64500</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0045\">\n    <timestamp>2026-08-05T03:36:00Z</timestamp>\n    <src_ip>203.0.113.146</src_ip>\n    <dst_ip>203.0.113.70</dst_ip>\n    <src_port>8463</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"3.4284711\">bc1qxmlSEEDIN0149</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"3.42709971\">bc1qxmlSEED9999</address>\n    </output_addresses>\n    <geo_country>DE</geo_country>\n    <asn>64502</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0048\">\n    <timestamp>2026-08-05T04:38:00Z</timestamp>\n    <src_ip>203.0.113.246</src_ip>\n    <dst_ip>203.0.113.124</dst_ip>\n    <src_port>39441</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"0.20496712\">bc1qxmlBURST0150</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"0.20486464\">bc1qxmlBURSTOUT0153</address>\n    </output_addresses>\n    <geo_country>RU</geo_country>\n    <asn>64500</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0037\">\n    <timestamp>2026-08-04T14:16:00Z</timestamp>\n    <src_ip>203.0.113.87</src_ip>\n    <dst_ip>203.0.113.56</dst_ip>\n    <src_port>57827</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"8.73867134\">bc1qxmlPEEL0110</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"8.52757858\">bc1qxmlPEEL0112</address>\n      <address amount=\"0.20672342\">bc1qxmlPEELCHG0113</address>\n    </output_addresses>\n    <geo_country>IN</geo_country>\n    <asn>64500</asn>\n  </transaction>\n  <transaction txid=\"tx_xml_0030\">\n    <timestamp>2026-08-04T02:52:00Z</timestamp>\n    <src_ip>203.0.113.174</src_ip>\n    <dst_ip>203.0.113.81</dst_ip>\n    <src_port>59845</src_port>\n    <dst_port>8333</dst_port>\n    <input_addresses>\n      <address amount=\"1.37478416\">bc1qxml0082</address>\n      <address amount=\"0.42195094\">bc1qxml0083</address>\n    </input_addresses>\n    <output_addresses>\n      <address amount=\"1.37068462\">bc1qxml0084</address>\n      <address amount=\"0.42533504\">bc1qxml0085</address>\n    </output_addresses>\n    <geo_country>RU</geo_country>\n    <asn>64503</asn>\n  </transaction>\n</transactions>",
    seeds: [{"address": "bc1qxmlSEED9999", "entity_name": "Known-High-Risk-Service-1", "entity_type": "illicit_service", "risk_score": 1.0, "label_confidence": 0.95, "source": "supplied_analyst_dataset", "first_flagged_txid": "tx_xml_0042"}]
  }
};

// Global Application State
const state = {
  currentDataset: 'json',
  rawTransactions: [],
  seedLabels: [],
  analyzedData: null,
  
  // Graph Display State
  viewMode: 'bipartite', // 'bipartite' | 'direct'
  layoutMode: 'force',   // 'force' | 'hierarchical'
  typologyFilter: 'ALL',
  riskFilter: 'ALL',
  searchQuery: '',
  selectedNodeId: null,
  selectedTxId: null,
  highlightedNodes: new Set(),
  highlightedEdges: new Set(),
  traversalPath: null,
  
  // Physics Simulation
  physicsEnabled: true,
  nodes: [],
  edges: [],
  nodeMap: new Map(),
  
  // Camera / Canvas Viewport
  camera: {
    x: 0,
    y: 0,
    zoom: 1.0,
    targetX: 0,
    targetY: 0,
    targetZoom: 1.0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    draggedNode: null
  },
  
  hoveredNode: null,
  hoveredEdge: null
};

// ==========================================================================
// Multi-Format Parsers
// ==========================================================================

function parseCsvData(csvString, seedLabels) {
  const lines = csvString.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const transactions = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line
    const values = line.split(',');
    if (values.length < headers.length) continue;
    
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ? values[idx].trim() : '';
    });
    
    // Pipe-separated lists
    const input_addresses = row.input_addresses ? row.input_addresses.split('|').filter(Boolean) : [];
    const output_addresses = row.output_addresses ? row.output_addresses.split('|').filter(Boolean) : [];
    const input_amounts = row.input_amounts ? row.input_amounts.split('|').map(Number) : [];
    const output_amounts = row.output_amounts ? row.output_amounts.split('|').map(Number) : [];
    
    transactions.push({
      timestamp: row.timestamp,
      src_ip: row.src_ip,
      dst_ip: row.dst_ip,
      src_port: parseInt(row.src_port, 10) || 8333,
      dst_port: parseInt(row.dst_port, 10) || 8333,
      txid: row.txid,
      input_addresses,
      output_addresses,
      input_amounts,
      output_amounts,
      geo_country: row.geo_country || 'US',
      asn: parseInt(row.asn, 10) || 64500
    });
  }
  return transactions;
}

function parseXmlData(xmlString, seedLabels) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  const txElements = xmlDoc.getElementsByTagName('transaction');
  const transactions = [];
  
  for (let i = 0; i < txElements.length; i++) {
    const el = txElements[i];
    const txid = el.getAttribute('txid') || `tx_xml_${i+1}`;
    const timestamp = el.getElementsByTagName('timestamp')[0]?.textContent || '';
    const src_ip = el.getElementsByTagName('src_ip')[0]?.textContent || '';
    const dst_ip = el.getElementsByTagName('dst_ip')[0]?.textContent || '';
    const src_port = parseInt(el.getElementsByTagName('src_port')[0]?.textContent || '8333', 10);
    const dst_port = parseInt(el.getElementsByTagName('dst_port')[0]?.textContent || '8333', 10);
    const geo_country = el.getElementsByTagName('geo_country')[0]?.textContent || 'US';
    const asn = parseInt(el.getElementsByTagName('asn')[0]?.textContent || '64500', 10);
    
    const input_addresses = [];
    const input_amounts = [];
    const inputAddrsEl = el.getElementsByTagName('input_addresses')[0];
    if (inputAddrsEl) {
      const addrs = inputAddrsEl.getElementsByTagName('address');
      for (let j = 0; j < addrs.length; j++) {
        input_addresses.push(addrs[j].textContent.trim());
        input_amounts.push(parseFloat(addrs[j].getAttribute('amount') || '0'));
      }
    }
    
    const output_addresses = [];
    const output_amounts = [];
    const outputAddrsEl = el.getElementsByTagName('output_addresses')[0];
    if (outputAddrsEl) {
      const addrs = outputAddrsEl.getElementsByTagName('address');
      for (let j = 0; j < addrs.length; j++) {
        output_addresses.push(addrs[j].textContent.trim());
        output_amounts.push(parseFloat(addrs[j].getAttribute('amount') || '0'));
      }
    }
    
    transactions.push({
      timestamp,
      src_ip,
      dst_ip,
      src_port,
      dst_port,
      txid,
      input_addresses,
      output_addresses,
      input_amounts,
      output_amounts,
      geo_country,
      asn
    });
  }
  return transactions;
}

// ==========================================================================
// Forensic Analysis & Typology Detection Engine
// ==========================================================================

function analyzeDataset(rawTxs, seedLabels) {
  const seedAddressMap = new Map();
  seedLabels.forEach(s => {
    seedAddressMap.set(s.address, s);
  });
  
  // Sort transactions chronologically
  const txs = [...rawTxs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Build address records
  const addresses = new Map();
  
  function getOrCreateAddress(addrStr) {
    if (!addresses.has(addrStr)) {
      addresses.set(addrStr, {
        address: addrStr,
        inflow: 0,
        outflow: 0,
        txCount: 0,
        inputTxs: [],
        outputTxs: [],
        riskScore: 0.0,
        seedDistance: Infinity,
        tags: new Set(),
        seedInfo: seedAddressMap.get(addrStr) || null
      });
    }
    return addresses.get(addrStr);
  }
  
  // First pass: register addresses & calculate flows
  txs.forEach(tx => {
    const totalIn = tx.input_amounts.reduce((a, b) => a + b, 0);
    const totalOut = tx.output_amounts.reduce((a, b) => a + b, 0);
    tx.totalInputBtc = totalIn;
    tx.totalOutputBtc = totalOut;
    tx.feeBtc = Math.max(0, totalIn - totalOut);
    
    tx.input_addresses.forEach((addr, idx) => {
      const a = getOrCreateAddress(addr);
      a.outflow += tx.input_amounts[idx] || 0;
      a.txCount++;
      a.inputTxs.push(tx.txid);
    });
    
    tx.output_addresses.forEach((addr, idx) => {
      const a = getOrCreateAddress(addr);
      a.inflow += tx.output_amounts[idx] || 0;
      a.txCount++;
      a.outputTxs.push(tx.txid);
    });
  });
  
  // Second pass: Typology Heuristics
  txs.forEach(tx => {
    const tags = new Set();
    const allAddrs = [...tx.input_addresses, ...tx.output_addresses];
    
    // Check for Seed connection
    const hasSeed = allAddrs.some(a => seedAddressMap.has(a) || a.includes('SEED'));
    if (hasSeed || (seedLabels[0] && seedLabels[0].first_flagged_txid === tx.txid)) {
      tags.add('SEED');
    }
    
    // Check for Peel Chain: 1 input, 2 outputs with change peel
    const hasPeelTag = allAddrs.some(a => a.includes('PEEL'));
    if (hasPeelTag || (tx.input_addresses.length === 1 && tx.output_addresses.length === 2 && (tx.output_amounts[0] > tx.output_amounts[1] * 3 || tx.output_amounts[1] > tx.output_amounts[0] * 3))) {
      tags.add('PEEL');
    }
    
    // Check for CoinJoin: multi-in multi-out equal amounts
    const hasCjTag = allAddrs.some(a => a.includes('CJ'));
    const isMultiEqual = tx.output_amounts.length >= 3 && (new Set(tx.output_amounts.map(v => v.toFixed(5)))).size === 1;
    if (hasCjTag || isMultiEqual) {
      tags.add('CJ');
    }
    
    // Check for Multi-Input Consolidation (Fan-in)
    const hasMiTag = allAddrs.some(a => a.includes('MI'));
    if (hasMiTag || (tx.input_addresses.length >= 3 && tx.output_addresses.length <= 2)) {
      tags.add('MI');
    }
    
    // Check for Burst / Fan-out
    const hasBurstTag = allAddrs.some(a => a.includes('BURST'));
    if (hasBurstTag) {
      tags.add('BURST');
    }
    
    // Check for High Value
    const hasHvTag = allAddrs.some(a => a.includes('HV'));
    if (hasHvTag || tx.totalOutputBtc >= 10.0) {
      tags.add('HV');
    }
    
    if (tags.size === 0) {
      tags.add('STANDARD');
    }
    
    tx.tags = Array.from(tags);
    tx.primaryTypology = tx.tags[0];
    
    // Propagate tags to addresses
    tx.input_addresses.forEach(addr => {
      const a = addresses.get(addr);
      tx.tags.forEach(t => a.tags.add(t));
    });
    tx.output_addresses.forEach(addr => {
      const a = addresses.get(addr);
      tx.tags.forEach(t => a.tags.add(t));
    });
  });
  
  // Third pass: BFS Taint Propagation & Shortest Distance to Seed
  // Build bidirectional adjacency graph
  const adj = new Map();
  function addEdge(u, v) {
    if (!adj.has(u)) adj.set(u, new Set());
    if (!adj.has(v)) adj.set(v, new Set());
    adj.get(u).add(v);
    adj.get(v).add(u);
  }
  
  txs.forEach(tx => {
    tx.input_addresses.forEach(inAddr => {
      addEdge(inAddr, tx.txid);
    });
    tx.output_addresses.forEach(outAddr => {
      addEdge(tx.txid, outAddr);
    });
  });
  
  // Multi-source BFS starting from seed addresses & seed transactions
  const queue = [];
  const distanceMap = new Map();
  
  seedLabels.forEach(s => {
    if (addresses.has(s.address)) {
      distanceMap.set(s.address, 0);
      queue.push(s.address);
    }
    if (s.first_flagged_txid) {
      distanceMap.set(s.first_flagged_txid, 0);
      queue.push(s.first_flagged_txid);
    }
  });
  
  // Also add any address containing SEED
  addresses.forEach((rec, addr) => {
    if (addr.includes('SEED') && !distanceMap.has(addr)) {
      distanceMap.set(addr, 0);
      queue.push(addr);
    }
  });
  
  while (queue.length > 0) {
    const curr = queue.shift();
    const currDist = distanceMap.get(curr);
    const neighbors = adj.get(curr) || [];
    
    neighbors.forEach(nxt => {
      if (!distanceMap.has(nxt)) {
        distanceMap.set(nxt, currDist + 1);
        queue.push(nxt);
      }
    });
  }
  
  // Assign risk scores based on distance & typology
  addresses.forEach((rec, addr) => {
    const dist = distanceMap.has(addr) ? distanceMap.get(addr) : Infinity;
    rec.seedDistance = dist;
    
    if (rec.seedInfo || addr.includes('SEED')) {
      rec.riskScore = 1.0;
    } else if (dist === 1 || dist === 2) {
      rec.riskScore = 0.85;
    } else if (dist === 3 || dist === 4) {
      rec.riskScore = 0.65;
    } else if (dist <= 6) {
      rec.riskScore = 0.45;
    } else if (dist < Infinity) {
      rec.riskScore = 0.30;
    } else {
      if (rec.tags.has('PEEL')) rec.riskScore = 0.35;
      else if (rec.tags.has('CJ')) rec.riskScore = 0.30;
      else if (rec.tags.has('HV')) rec.riskScore = 0.20;
      else rec.riskScore = 0.05;
    }
  });
  
  txs.forEach(tx => {
    const dist = distanceMap.has(tx.txid) ? distanceMap.get(tx.txid) : Infinity;
    tx.seedDistance = dist;
    
    // Risk score is calculated from connected addresses & proximity
    const inRisks = tx.input_addresses.map(a => addresses.get(a)?.riskScore || 0);
    const outRisks = tx.output_addresses.map(a => addresses.get(a)?.riskScore || 0);
    const maxAddrRisk = Math.max(0, ...inRisks, ...outRisks);
    
    if (tx.tags.includes('SEED')) {
      tx.riskScore = 1.0;
    } else if (dist <= 2) {
      tx.riskScore = Math.max(maxAddrRisk, 0.85);
    } else if (dist <= 4) {
      tx.riskScore = Math.max(maxAddrRisk, 0.65);
    } else {
      tx.riskScore = maxAddrRisk;
    }
  });
  
  // Compute Aggregates & Insights
  const totalVolume = txs.reduce((acc, t) => acc + t.totalOutputBtc, 0);
  const taintedTxs = txs.filter(t => t.riskScore >= 0.65);
  const taintedVolume = taintedTxs.reduce((acc, t) => acc + t.totalOutputBtc, 0);
  
  // Typology counts
  const typologyCounts = {
    SEED: 0,
    PEEL: 0,
    CJ: 0,
    MI: 0,
    BURST: 0,
    HV: 0,
    STANDARD: 0
  };
  
  txs.forEach(t => {
    t.tags.forEach(tag => {
      if (typologyCounts[tag] !== undefined) typologyCounts[tag]++;
    });
  });
  
  // Geo & ASN counts
  const geoCounts = {};
  const asnCounts = {};
  const portCounts = { mainnet: 0, testnet: 0, rpc: 0, other: 0 };
  
  txs.forEach(t => {
    geoCounts[t.geo_country] = (geoCounts[t.geo_country] || 0) + 1;
    asnCounts[t.asn] = (asnCounts[t.asn] || 0) + 1;
    
    if (t.dst_port === 8333 || t.src_port === 8333) portCounts.mainnet++;
    else if (t.dst_port === 18333 || t.src_port === 18333) portCounts.testnet++;
    else if (t.dst_port === 8332 || t.src_port === 8332) portCounts.rpc++;
    else portCounts.other++;
  });
  
  return {
    transactions: txs,
    addresses,
    seedLabels,
    adjacency: adj,
    distanceMap,
    metrics: {
      totalTx: txs.length,
      totalVolume,
      taintedVolume,
      taintedTxCount: taintedTxs.length,
      totalAddresses: addresses.size,
      typologyCounts,
      geoCounts,
      asnCounts,
      portCounts,
      timeRange: {
        start: txs[0]?.timestamp || '',
        end: txs[txs.length - 1]?.timestamp || ''
      }
    }
  };
}

// ==========================================================================
// Graph Model & Layout Generator
// ==========================================================================

function buildGraphElements(analyzedData, viewMode, typologyFilter, riskFilter) {
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();
  
  const { transactions, addresses, distanceMap } = analyzedData;
  
  // Filter transactions
  const visibleTxs = transactions.filter(tx => {
    if (typologyFilter !== 'ALL' && !tx.tags.includes(typologyFilter)) return false;
    if (riskFilter === 'HIGH' && tx.riskScore < 0.75) return false;
    if (riskFilter === 'MEDIUM' && (tx.riskScore < 0.35 || tx.riskScore >= 0.75)) return false;
    if (riskFilter === 'LOW' && tx.riskScore >= 0.35) return false;
    return true;
  });
  
  const activeTxSet = new Set(visibleTxs.map(t => t.txid));
  const activeAddrSet = new Set();
  
  visibleTxs.forEach(tx => {
    tx.input_addresses.forEach(a => activeAddrSet.add(a));
    tx.output_addresses.forEach(a => activeAddrSet.add(a));
  });
  
  if (viewMode === 'bipartite') {
    // Mode 1: Address Nodes + Transaction Hex Nodes
    activeAddrSet.forEach(addrStr => {
      const addrData = addresses.get(addrStr);
      const isSeed = addrData?.seedInfo !== null || addrStr.includes('SEED');
      const typology = Array.from(addrData?.tags || ['STANDARD'])[0] || 'STANDARD';
      
      const node = {
        id: addrStr,
        label: shortenString(addrStr, 10),
        fullLabel: addrStr,
        type: 'address',
        typology: isSeed ? 'SEED' : typology,
        riskScore: addrData?.riskScore || 0,
        seedDistance: addrData?.seedDistance ?? Infinity,
        inflow: addrData?.inflow || 0,
        outflow: addrData?.outflow || 0,
        data: addrData,
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 600,
        vx: 0,
        vy: 0,
        radius: isSeed ? 16 : 10 + Math.min(8, (addrData?.inflow || 0) * 1.5)
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });
    
    visibleTxs.forEach(tx => {
      const isSeed = tx.tags.includes('SEED');
      const node = {
        id: tx.txid,
        label: tx.txid,
        fullLabel: tx.txid,
        type: 'transaction',
        typology: isSeed ? 'SEED' : tx.primaryTypology,
        riskScore: tx.riskScore,
        seedDistance: tx.seedDistance,
        volume: tx.totalOutputBtc,
        fee: tx.feeBtc,
        data: tx,
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 600,
        vx: 0,
        vy: 0,
        radius: isSeed ? 18 : 12 + Math.min(10, Math.log10(Math.max(1, tx.totalOutputBtc)) * 4)
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
      
      // Edges: Inputs -> TX
      tx.input_addresses.forEach((inAddr, idx) => {
        if (nodeMap.has(inAddr)) {
          edges.push({
            id: `${inAddr}->${tx.txid}`,
            source: inAddr,
            target: tx.txid,
            amount: tx.input_amounts[idx] || 0,
            type: 'inflow'
          });
        }
      });
      
      // Edges: TX -> Outputs
      tx.output_addresses.forEach((outAddr, idx) => {
        if (nodeMap.has(outAddr)) {
          edges.push({
            id: `${tx.txid}->${outAddr}`,
            source: tx.txid,
            target: outAddr,
            amount: tx.output_amounts[idx] || 0,
            type: 'outflow'
          });
        }
      });
    });
  } else {
    // Mode 2: Direct Address-to-Address graph
    activeAddrSet.forEach(addrStr => {
      const addrData = addresses.get(addrStr);
      const isSeed = addrData?.seedInfo !== null || addrStr.includes('SEED');
      const typology = Array.from(addrData?.tags || ['STANDARD'])[0] || 'STANDARD';
      
      const node = {
        id: addrStr,
        label: shortenString(addrStr, 10),
        fullLabel: addrStr,
        type: 'address',
        typology: isSeed ? 'SEED' : typology,
        riskScore: addrData?.riskScore || 0,
        seedDistance: addrData?.seedDistance ?? Infinity,
        inflow: addrData?.inflow || 0,
        outflow: addrData?.outflow || 0,
        data: addrData,
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 600,
        vx: 0,
        vy: 0,
        radius: isSeed ? 18 : 12 + Math.min(8, (addrData?.inflow || 0) * 1.5)
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });
    
    visibleTxs.forEach(tx => {
      tx.input_addresses.forEach((inAddr, i) => {
        tx.output_addresses.forEach((outAddr, j) => {
          if (nodeMap.has(inAddr) && nodeMap.has(outAddr)) {
            edges.push({
              id: `${inAddr}->${outAddr}@${tx.txid}`,
              source: inAddr,
              target: outAddr,
              amount: tx.output_amounts[j] || 0,
              txid: tx.txid,
              type: 'direct'
            });
          }
        });
      });
    });
  }
  
  return { nodes, edges, nodeMap };
}

function applyHierarchicalLayout(nodes, edges, transactions) {
  // Order nodes horizontally based on timestamps or topology
  const timeMap = new Map();
  transactions.forEach((tx, idx) => {
    const t = new Date(tx.timestamp).getTime();
    timeMap.set(tx.txid, { time: t, rank: idx });
    tx.input_addresses.forEach(a => {
      if (!timeMap.has(a) || timeMap.get(a).time > t) {
        timeMap.set(a, { time: t - 1000, rank: idx - 0.5 });
      }
    });
    tx.output_addresses.forEach(a => {
      if (!timeMap.has(a) || timeMap.get(a).time < t) {
        timeMap.set(a, { time: t + 1000, rank: idx + 0.5 });
      }
    });
  });
  
  // Calculate ranks
  const ranks = nodes.map(n => timeMap.get(n.id)?.rank || 0);
  const minRank = Math.min(...ranks, 0);
  const maxRank = Math.max(...ranks, 1);
  const rankSpan = Math.max(1, maxRank - minRank);
  
  const typologyYOffsets = {
    SEED: -180,
    PEEL: -90,
    CJ: 0,
    MI: 80,
    BURST: 160,
    HV: -240,
    STANDARD: 240
  };
  
  nodes.forEach((node, idx) => {
    const rank = timeMap.get(node.id)?.rank || 0;
    const normalizedX = ((rank - minRank) / rankSpan - 0.5) * 1400;
    const baseY = typologyYOffsets[node.typology] || 0;
    const jitterY = ((idx % 7) - 3) * 28;
    
    node.x = normalizedX;
    node.y = baseY + jitterY;
    node.vx = 0;
    node.vy = 0;
  });
}

// ==========================================================================
// Canvas Graph Renderer (60 FPS Interactive Engine)
// ==========================================================================

class GraphCanvasRenderer {
  constructor(canvasEl, containerEl) {
    this.canvas = canvasEl;
    this.container = containerEl;
    this.ctx = canvasEl.getContext('2d');
    
    this.dpr = window.devicePixelRatio || 1;
    this.animationFrameId = null;
    this.pulseAngle = 0;
    
    this.initEvents();
    this.resize();
  }
  
  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }
  
  initEvents() {
    window.addEventListener('resize', () => {
      this.resize();
      this.draw();
    });
    
    // Mouse Down (Pan or Drag Node)
    this.canvas.addEventListener('mousedown', e => {
      const mousePos = this.getCanvasMousePos(e);
      const clickedNode = this.getNodeAt(mousePos.worldX, mousePos.worldY);
      
      if (clickedNode) {
        state.camera.draggedNode = clickedNode;
        selectNode(clickedNode.id);
      } else {
        state.camera.isPanning = true;
        state.camera.panStartX = e.clientX - state.camera.x;
        state.camera.panStartY = e.clientY - state.camera.y;
      }
    });
    
    // Mouse Move (Hover & Drag)
    this.canvas.addEventListener('mousemove', e => {
      const mousePos = this.getCanvasMousePos(e);
      
      if (state.camera.draggedNode) {
        state.camera.draggedNode.x = mousePos.worldX;
        state.camera.draggedNode.y = mousePos.worldY;
        state.camera.draggedNode.vx = 0;
        state.camera.draggedNode.vy = 0;
        return;
      }
      
      if (state.camera.isPanning) {
        state.camera.x = e.clientX - state.camera.panStartX;
        state.camera.y = e.clientY - state.camera.panStartY;
        return;
      }
      
      const hovered = this.getNodeAt(mousePos.worldX, mousePos.worldY);
      if (hovered !== state.hoveredNode) {
        state.hoveredNode = hovered;
        this.canvas.style.cursor = hovered ? 'pointer' : 'grab';
      }
    });
    
    // Mouse Up
    window.addEventListener('mouseup', () => {
      state.camera.draggedNode = null;
      state.camera.isPanning = false;
    });
    
    // Wheel (Zoom)
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const mousePos = this.getCanvasMousePos(e);
      
      const newZoom = Math.max(0.15, Math.min(4.0, state.camera.zoom * zoomFactor));
      
      // Zoom centered at mouse position
      state.camera.x = mousePos.screenX - (mousePos.screenX - state.camera.x) * (newZoom / state.camera.zoom);
      state.camera.y = mousePos.screenY - (mousePos.screenY - state.camera.y) * (newZoom / state.camera.zoom);
      state.camera.zoom = newZoom;
    }, { passive: false });
    
    // Double click to focus
    this.canvas.addEventListener('dblclick', e => {
      const mousePos = this.getCanvasMousePos(e);
      const clicked = this.getNodeAt(mousePos.worldX, mousePos.worldY);
      if (clicked) {
        this.zoomToNode(clicked);
      } else {
        this.fitToScreen();
      }
    });
  }
  
  getCanvasMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldX = (screenX - this.width / 2 - state.camera.x) / state.camera.zoom;
    const worldY = (screenY - this.height / 2 - state.camera.y) / state.camera.zoom;
    return { screenX, screenY, worldX, worldY };
  }
  
  getNodeAt(x, y) {
    for (let i = state.nodes.length - 1; i >= 0; i--) {
      const n = state.nodes[i];
      const dx = n.x - x;
      const dy = n.y - y;
      if (dx * dx + dy * dy <= (n.radius + 6) * (n.radius + 6)) {
        return n;
      }
    }
    return null;
  }
  
  fitToScreen() {
    if (state.nodes.length === 0) return;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    state.nodes.forEach(n => {
      minX = Math.min(minX, n.x - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    });
    
    const padding = 80;
    const graphWidth = maxX - minX + padding * 2;
    const graphHeight = maxY - minY + padding * 2;
    
    const zoomX = this.width / graphWidth;
    const zoomY = this.height / graphHeight;
    state.camera.zoom = Math.max(0.2, Math.min(1.2, Math.min(zoomX, zoomY)));
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    state.camera.x = -centerX * state.camera.zoom;
    state.camera.y = -centerY * state.camera.zoom;
  }
  
  zoomToNode(node) {
    state.camera.zoom = 1.3;
    state.camera.x = -node.x * state.camera.zoom;
    state.camera.y = -node.y * state.camera.zoom;
  }
  
  // Physics Step (Spring-embedder Force Simulation)
  stepPhysics() {
    if (!state.physicsEnabled || state.layoutMode === 'hierarchical') return;
    
    const nodes = state.nodes;
    const edges = state.edges;
    const nodeMap = state.nodeMap;
    
    const repulsionK = 2500;
    const springK = 0.04;
    const springLength = 80;
    const centerGravity = 0.008;
    const damping = 0.88;
    
    // Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const distSq = Math.max(100, dx * dx + dy * dy);
        const dist = Math.sqrt(distSq);
        
        const force = repulsionK / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        n1.vx -= fx;
        n1.vy -= fy;
        n2.vx += fx;
        n2.vy += fy;
      }
      
      // Center Gravity
      n1.vx -= n1.x * centerGravity;
      n1.vy -= n1.y * centerGravity;
    }
    
    // Spring forces along edges
    edges.forEach(e => {
      const source = nodeMap.get(e.source);
      const target = nodeMap.get(e.target);
      if (!source || !target) return;
      
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const displacement = dist - springLength;
      
      const fx = (dx / dist) * displacement * springK;
      const fy = (dy / dist) * displacement * springK;
      
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    });
    
    // Apply velocities with damping
    nodes.forEach(n => {
      if (n === state.camera.draggedNode) return;
      n.vx *= damping;
      n.vy *= damping;
      
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (speed > 15) {
        n.vx = (n.vx / speed) * 15;
        n.vy = (n.vy / speed) * 15;
      }
      
      n.x += n.vx;
      n.y += n.vy;
    });
  }
  
  start() {
    const loop = () => {
      this.stepPhysics();
      this.pulseAngle += 0.05;
      this.draw();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = requestAnimationFrame(loop);
  }
  
  stop() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
  }
  
  getNodeColor(node) {
    if (node.typology === 'SEED' || node.riskScore >= 0.85) return '#ef4444';
    if (node.typology === 'PEEL') return '#f97316';
    if (node.typology === 'CJ') return '#a855f7';
    if (node.typology === 'MI') return '#06b6d4';
    if (node.typology === 'BURST') return '#eab308';
    if (node.typology === 'HV') return '#10b981';
    return '#64748b';
  }
  
  draw() {
    const ctx = this.ctx;
    ctx.save();
    
    // Scale for device pixel ratio
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.width, this.height);
    
    // Background Grid
    ctx.fillStyle = '#070b12';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Apply camera transformation
    ctx.save();
    ctx.translate(this.width / 2 + state.camera.x, this.height / 2 + state.camera.y);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    
    // Grid Lines
    this.drawBackgroundGrid(ctx);
    
    const isHighlightActive = state.highlightedNodes.size > 0 || state.selectedNodeId !== null;
    
    // 1. Draw Edges
    state.edges.forEach(edge => {
      const source = state.nodeMap.get(edge.source);
      const target = state.nodeMap.get(edge.target);
      if (!source || !target) return;
      
      const isHighlighted = state.highlightedEdges.has(edge.id) || 
        (state.selectedNodeId && (source.id === state.selectedNodeId || target.id === state.selectedNodeId));
      
      const isPathEdge = state.traversalPath && state.traversalPath.edgeIds.has(edge.id);
      
      ctx.save();
      ctx.beginPath();
      
      if (isPathEdge) {
        // Active Traversal Path
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
      } else if (isHighlighted) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
      } else if (isHighlightActive) {
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
        ctx.lineWidth = 1.2;
      }
      
      // Draw straight / curved directed line
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      
      // Directional Arrow
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        const arrowDist = target.radius + 8;
        const arrowX = target.x - (dx / dist) * arrowDist;
        const arrowY = target.y - (dy / dist) * arrowDist;
        const angle = Math.atan2(dy, dx);
        
        ctx.fillStyle = isPathEdge ? '#ef4444' : (isHighlighted ? '#38bdf8' : 'rgba(100, 116, 139, 0.6)');
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - 8 * Math.cos(angle - Math.PI / 6), arrowY - 8 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(arrowX - 8 * Math.cos(angle + Math.PI / 6), arrowY - 8 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.restore();
    });
    
    // 2. Draw Nodes
    state.nodes.forEach(node => {
      const isSelected = state.selectedNodeId === node.id;
      const isHovered = state.hoveredNode === node;
      const isHighlighted = state.highlightedNodes.has(node.id) || isSelected;
      const isSeed = node.typology === 'SEED' || node.id.includes('SEED');
      const nodeColor = this.getNodeColor(node);
      
      const dimmed = isHighlightActive && !isHighlighted && !isSelected;
      
      ctx.save();
      
      // Halo / Glow for Seeds & High-Risk Nodes
      if (isSeed || node.riskScore >= 0.85) {
        const pulse = 4 + Math.sin(this.pulseAngle) * 3;
        const gradient = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, node.radius + pulse + 8);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + pulse + 8, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Node Body
      ctx.beginPath();
      if (node.type === 'transaction') {
        // Hexagon / Rounded square for transactions
        this.drawHexagon(ctx, node.x, node.y, node.radius);
      } else {
        // Circle for Addresses
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      }
      
      ctx.fillStyle = dimmed ? 'rgba(30, 41, 59, 0.5)' : nodeColor;
      ctx.fill();
      
      // Border & Selection Ring
      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
      } else if (isHighlighted) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = dimmed ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
      }
      ctx.stroke();
      
      // Node Icon / Inner symbol
      if (!dimmed) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px ' + (node.type === 'transaction' ? 'monospace' : 'sans-serif');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const innerText = node.type === 'transaction' ? 'TX' : (isSeed ? '★' : '');
        if (innerText) ctx.fillText(innerText, node.x, node.y);
      }
      
      // Label text below node
      if ((state.camera.zoom > 0.75 || isSelected || isHovered || isSeed) && !dimmed) {
        ctx.fillStyle = isSelected ? '#ffffff' : (isHovered ? '#38bdf8' : '#94a3b8');
        ctx.font = `${isSelected ? 'bold 11px' : '10px'} "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + node.radius + 12);
      }
      
      ctx.restore();
    });
    
    ctx.restore(); // Camera
    
    // 3. Draw Hover Tooltip on Screen Space
    if (state.hoveredNode && !state.camera.isPanning) {
      this.drawTooltip(ctx, state.hoveredNode);
    }
    
    ctx.restore(); // DPI
  }
  
  drawHexagon(ctx, x, y, r) {
    const sides = 6;
    ctx.moveTo(x + r * Math.cos(0), y + r * Math.sin(0));
    for (let i = 1; i <= sides; i++) {
      ctx.lineTo(x + r * Math.cos(i * 2 * Math.PI / sides), y + r * Math.sin(i * 2 * Math.PI / sides));
    }
    ctx.closePath();
  }
  
  drawBackgroundGrid(ctx) {
    const gridSize = 60;
    const halfW = 1200;
    const halfH = 900;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -halfW; x <= halfW; x += gridSize) {
      ctx.moveTo(x, -halfH);
      ctx.lineTo(x, halfH);
    }
    for (let y = -halfH; y <= halfH; y += gridSize) {
      ctx.moveTo(-halfW, y);
      ctx.lineTo(halfW, y);
    }
    ctx.stroke();
  }
  
  drawTooltip(ctx, node) {
    const screenX = (node.x * state.camera.zoom) + this.width / 2 + state.camera.x;
    const screenY = (node.y * state.camera.zoom) + this.height / 2 + state.camera.y;
    
    const lines = [
      `${node.type === 'transaction' ? 'TX' : 'Address'}: ${node.fullLabel}`,
      `Typology: ${node.typology} | Risk: ${(node.riskScore * 100).toFixed(0)}%`,
      `Seed Proximity: ${node.seedDistance === 0 ? 'Anchor (Direct)' : (node.seedDistance < Infinity ? node.seedDistance + ' Hops' : 'Unlinked')}`
    ];
    
    if (node.type === 'transaction') {
      lines.push(`Volume: ${node.volume?.toFixed(4)} BTC | Fee: ${node.fee?.toFixed(6)} BTC`);
    } else {
      lines.push(`Inflow: ${node.inflow?.toFixed(4)} BTC | Outflow: ${node.outflow?.toFixed(4)} BTC`);
    }
    
    ctx.font = '11px "Inter", sans-serif';
    let maxW = 0;
    lines.forEach(l => {
      maxW = Math.max(maxW, ctx.measureText(l).width);
    });
    
    const boxW = maxW + 20;
    const boxH = lines.length * 16 + 14;
    const boxX = Math.min(this.width - boxW - 10, Math.max(10, screenX - boxW / 2));
    const boxY = screenY - node.radius - boxH - 12 > 10 ? screenY - node.radius - boxH - 12 : screenY + node.radius + 14;
    
    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();
    
    // Text lines
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    lines.forEach((line, idx) => {
      if (idx === 0) ctx.fillStyle = '#38bdf8';
      else if (idx === 1 && line.includes('Risk: 100%')) ctx.fillStyle = '#f87171';
      else ctx.fillStyle = '#cbd5e1';
      
      ctx.fillText(line, boxX + 10, boxY + 16 + idx * 16);
    });
  }
}

// Global Canvas Instance
let graphRenderer = null;

// ==========================================================================
// Traversal & Forensic Algorithms
// ==========================================================================

function traceShortestPathToSeed(startNodeId) {
  if (!state.analyzedData) return null;
  const { adjacency, seedLabels, addresses } = state.analyzedData;
  
  // Identify seed target nodes
  const seedTargets = new Set();
  seedLabels.forEach(s => {
    seedTargets.add(s.address);
    if (s.first_flagged_txid) seedTargets.add(s.first_flagged_txid);
  });
  addresses.forEach((rec, addr) => {
    if (addr.includes('SEED')) seedTargets.add(addr);
  });
  
  if (seedTargets.has(startNodeId)) {
    return { path: [startNodeId], edgeIds: new Set(), hops: 0 };
  }
  
  // BFS shortest path
  const queue = [[startNodeId]];
  const visited = new Set([startNodeId]);
  
  while (queue.length > 0) {
    const path = queue.shift();
    const curr = path[path.length - 1];
    
    if (seedTargets.has(curr)) {
      // Reconstruct edges
      const edgeIds = new Set();
      for (let i = 0; i < path.length - 1; i++) {
        edgeIds.add(`${path[i]}->${path[i+1]}`);
        edgeIds.add(`${path[i+1]}->${path[i]}`);
      }
      return { path, edgeIds, hops: path.length - 1 };
    }
    
    const neighbors = adjacency.get(curr) || [];
    neighbors.forEach(nxt => {
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push([...path, nxt]);
      }
    });
  }
  
  return null;
}

function traceAncestors(startNodeId) {
  if (!state.analyzedData) return new Set();
  const { transactions } = state.analyzedData;
  const upstreamNodes = new Set([startNodeId]);
  const queue = [startNodeId];
  
  while (queue.length > 0) {
    const curr = queue.shift();
    transactions.forEach(tx => {
      if (tx.txid === curr) {
        tx.input_addresses.forEach(inAddr => {
          if (!upstreamNodes.has(inAddr)) {
            upstreamNodes.add(inAddr);
            queue.push(inAddr);
          }
        });
      } else if (tx.output_addresses.includes(curr)) {
        if (!upstreamNodes.has(tx.txid)) {
          upstreamNodes.add(tx.txid);
          queue.push(tx.txid);
        }
      }
    });
  }
  return upstreamNodes;
}

function traceDescendants(startNodeId) {
  if (!state.analyzedData) return new Set();
  const { transactions } = state.analyzedData;
  const downstreamNodes = new Set([startNodeId]);
  const queue = [startNodeId];
  
  while (queue.length > 0) {
    const curr = queue.shift();
    transactions.forEach(tx => {
      if (tx.txid === curr) {
        tx.output_addresses.forEach(outAddr => {
          if (!downstreamNodes.has(outAddr)) {
            downstreamNodes.add(outAddr);
            queue.push(outAddr);
          }
        });
      } else if (tx.input_addresses.includes(curr)) {
        if (!downstreamNodes.has(tx.txid)) {
          downstreamNodes.add(tx.txid);
          queue.push(tx.txid);
        }
      }
    });
  }
  return downstreamNodes;
}

// ==========================================================================
// UI Updates & Interactions
// ==========================================================================

function updateKpiCards(metrics) {
  document.getElementById('kpiTotalTx').textContent = metrics.totalTx;
  document.getElementById('kpiTotalVolume').innerHTML = `${metrics.totalVolume.toFixed(2)} <span class="unit">BTC</span>`;
  document.getElementById('kpiAvgTxVolume').textContent = `Avg: ${(metrics.totalVolume / Math.max(1, metrics.totalTx)).toFixed(2)} BTC / tx`;
  
  document.getElementById('kpiTaintVolume').innerHTML = `${metrics.taintedVolume.toFixed(2)} <span class="unit">BTC</span>`;
  document.getElementById('kpiTaintedTxsCount').textContent = `${metrics.taintedTxCount} Tainted Transactions Flagged`;
  
  document.getElementById('kpiTotalAddresses').textContent = metrics.totalAddresses;
  
  const patternTotal = metrics.typologyCounts.PEEL + metrics.typologyCounts.CJ + metrics.typologyCounts.BURST + metrics.typologyCounts.MI;
  document.getElementById('kpiPatternsCount').textContent = patternTotal;
  
  document.getElementById('kpiBlockTime').textContent = `Time: ${metrics.timeRange.start.slice(0, 10)} to ${metrics.timeRange.end.slice(0, 10)}`;
}

function updateTypologyBars(typologyCounts, totalTx) {
  const container = document.getElementById('typologyBarsList');
  container.innerHTML = '';
  
  const labels = {
    SEED: { name: '🔴 Illicit Seed Anchor & Direct', color: '#ef4444' },
    PEEL: { name: '🟠 Peel Chains & Change Hops', color: '#f97316' },
    CJ: { name: '🟣 CoinJoin / Equal-Value Mixers', color: '#a855f7' },
    MI: { name: '🔵 Multi-Input Consolidations', color: '#06b6d4' },
    BURST: { name: '🟡 Burst / Rapid Fan-outs', color: '#eab308' },
    HV: { name: '🟢 High-Value (&gt;10 BTC)', color: '#10b981' },
    STANDARD: { name: '⚪ Standard Transactions', color: '#64748b' }
  };
  
  Object.entries(typologyCounts).forEach(([key, count]) => {
    const meta = labels[key] || { name: key, color: '#64748b' };
    const pct = ((count / Math.max(1, totalTx)) * 100).toFixed(0);
    
    const div = document.createElement('div');
    div.className = 'progress-item';
    div.innerHTML = `
      <div class="progress-label-row">
        <span class="progress-title">${meta.name}</span>
        <span class="progress-val">${count} TX (${pct}%)</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${pct}%; background-color: ${meta.color};"></div>
      </div>
    `;
    div.style.cursor = 'pointer';
    div.addEventListener('click', () => {
      document.getElementById('selectTypologyFilter').value = key;
      document.getElementById('tableTypologySelect').value = key;
      applyFilters();
    });
    container.appendChild(div);
  });
}

function updateGeoBars(geoCounts, asnCounts, totalTx) {
  const container = document.getElementById('geoBarsList');
  container.innerHTML = '';
  
  const countryNames = {
    US: '🇺🇸 United States',
    DE: '🇩🇪 Germany',
    SG: '🇸🇬 Singapore',
    NL: '🇳🇱 Netherlands',
    IN: '🇮🇳 India',
    RU: '🇷🇺 Russia'
  };
  
  Object.entries(geoCounts).sort((a, b) => b[1] - a[1]).forEach(([country, count]) => {
    const name = countryNames[country] || `🌐 ${country}`;
    const pct = ((count / Math.max(1, totalTx)) * 100).toFixed(0);
    
    const div = document.createElement('div');
    div.className = 'progress-item';
    div.innerHTML = `
      <div class="progress-label-row">
        <span class="progress-title">${name}</span>
        <span class="progress-val">${count} TX (${pct}%)</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${pct}%; background: linear-gradient(90deg, #38bdf8, #818cf8);"></div>
      </div>
    `;
    container.appendChild(div);
  });
}

function updatePortStats(portCounts) {
  const container = document.getElementById('portsSummaryContainer');
  container.innerHTML = `
    <div class="port-box">
      <div class="port-badge-info">
        <span class="port-num">Port 8333</span>
        <span class="port-desc">Bitcoin Mainnet P2P</span>
      </div>
      <span class="port-stats">${portCounts.mainnet} Relays</span>
    </div>
    <div class="port-box">
      <div class="port-badge-info">
        <span class="port-num">Port 18333</span>
        <span class="port-desc">Bitcoin Testnet P2P</span>
      </div>
      <span class="port-stats">${portCounts.testnet} Relays</span>
    </div>
    <div class="port-box">
      <div class="port-badge-info">
        <span class="port-num">Port 8332</span>
        <span class="port-desc">Bitcoin JSON-RPC</span>
      </div>
      <span class="port-stats">${portCounts.rpc} Relays</span>
    </div>
  `;
}

function updateTransactionsTable(transactions) {
  const tbody = document.getElementById('transactionsTableBody');
  tbody.innerHTML = '';
  
  const search = (document.getElementById('tableSearchInput')?.value || '').toLowerCase();
  const typoFilter = document.getElementById('tableTypologySelect')?.value || 'ALL';
  const riskFilter = document.getElementById('tableRiskSelect')?.value || 'ALL';
  
  const filtered = transactions.filter(tx => {
    if (typoFilter !== 'ALL' && !tx.tags.includes(typoFilter)) return false;
    if (riskFilter === 'HIGH' && tx.riskScore < 0.75) return false;
    if (riskFilter === 'MEDIUM' && (tx.riskScore < 0.35 || tx.riskScore >= 0.75)) return false;
    if (riskFilter === 'LOW' && tx.riskScore >= 0.35) return false;
    
    if (search) {
      const matchTx = tx.txid.toLowerCase().includes(search);
      const matchIn = tx.input_addresses.some(a => a.toLowerCase().includes(search));
      const matchOut = tx.output_addresses.some(a => a.toLowerCase().includes(search));
      const matchGeo = tx.geo_country.toLowerCase().includes(search);
      if (!matchTx && !matchIn && !matchOut && !matchGeo) return false;
    }
    return true;
  });
  
  document.getElementById('tableFilterCount').textContent = `Showing ${filtered.length} of ${transactions.length} Transactions`;
  
  filtered.forEach(tx => {
    const tr = document.createElement('tr');
    if (state.selectedTxId === tx.txid) tr.classList.add('active-row');
    
    const riskPercent = (tx.riskScore * 100).toFixed(0);
    const riskBadgeClass = tx.riskScore >= 0.75 ? 'danger' : (tx.riskScore >= 0.35 ? 'purple' : 'neutral');
    
    tr.innerHTML = `
      <td><span class="table-txid">${tx.txid}</span></td>
      <td>${tx.timestamp.replace('T', ' ').replace('Z', '')}</td>
      <td>${tx.input_addresses.length} in (${tx.totalInputBtc.toFixed(4)} BTC)</td>
      <td>${tx.output_addresses.length} out (${tx.totalOutputBtc.toFixed(4)} BTC)</td>
      <td class="font-mono">${tx.totalOutputBtc.toFixed(4)} BTC</td>
      <td class="font-mono">${tx.feeBtc.toFixed(6)}</td>
      <td><span class="table-pill tag-${tx.primaryTypology.toLowerCase()}">${tx.primaryTypology}</span></td>
      <td>${tx.geo_country} • ASN ${tx.asn}</td>
      <td><span class="kpi-badge ${riskBadgeClass}">${riskPercent}%</span></td>
      <td><button class="btn btn-secondary btn-sm btn-inspect-row">Inspect</button></td>
    `;
    
    tr.addEventListener('click', (e) => {
      selectTx(tx.txid);
    });
    
    tr.querySelector('.btn-inspect-row').addEventListener('click', (e) => {
      e.stopPropagation();
      openTxModal(tx);
    });
    
    tbody.appendChild(tr);
  });
}

function selectNode(nodeId) {
  state.selectedNodeId = nodeId;
  const node = state.nodeMap.get(nodeId);
  if (!node) return;
  
  // Highlight connected neighborhood
  state.highlightedNodes.clear();
  state.highlightedEdges.clear();
  
  state.highlightedNodes.add(nodeId);
  state.edges.forEach(e => {
    if (e.source === nodeId || e.target === nodeId) {
      state.highlightedEdges.add(e.id);
      state.highlightedNodes.add(e.source);
      state.highlightedNodes.add(e.target);
    }
  });
  
  if (node.type === 'transaction') {
    state.selectedTxId = node.id;
  }
  
  updateInspectorPanel(node);
  updateTransactionsTable(state.analyzedData.transactions);
}

function selectTx(txid) {
  state.selectedTxId = txid;
  selectNode(txid);
  
  const node = state.nodeMap.get(txid);
  if (node && graphRenderer) {
    graphRenderer.zoomToNode(node);
  }
}

function updateInspectorPanel(node) {
  const emptyState = document.getElementById('inspectorEmpty');
  const detailsState = document.getElementById('inspectorDetails');
  
  emptyState.style.display = 'none';
  detailsState.style.display = 'flex';
  
  document.getElementById('inspNodeTypeBadge').textContent = node.type === 'transaction' ? 'Transaction' : 'Address Entity';
  document.getElementById('inspNodeId').textContent = node.fullLabel;
  
  const riskPill = document.getElementById('inspRiskPill');
  const riskPct = (node.riskScore * 100).toFixed(0);
  riskPill.textContent = `Risk: ${riskPct}%`;
  riskPill.className = 'inspector-risk-pill ' + (node.riskScore >= 0.75 ? 'risk-high' : (node.riskScore >= 0.35 ? 'risk-med' : ''));
  
  document.getElementById('inspRiskScoreVal').textContent = `${node.riskScore.toFixed(2)} / 1.00`;
  document.getElementById('inspRiskBar').style.width = `${riskPct}%`;
  
  const distText = node.seedDistance === 0 ? '0 Hops (Direct Anchor)' : (node.seedDistance < Infinity ? `${node.seedDistance} Hops from Illicit Seed` : 'No Connection Found');
  document.getElementById('inspSeedDistVal').textContent = distText;
  
  // Tags container
  const tagsContainer = document.getElementById('inspTagsContainer');
  tagsContainer.innerHTML = '';
  const tags = node.type === 'transaction' ? node.data.tags : Array.from(node.data.tags || [node.typology]);
  tags.forEach(t => {
    const span = document.createElement('span');
    span.className = `tag-pill tag-${t.toLowerCase()}`;
    span.textContent = t;
    tagsContainer.appendChild(span);
  });
  
  // Inflow / Outflow
  if (node.type === 'transaction') {
    document.getElementById('inspInflow').textContent = `${node.data.totalInputBtc.toFixed(4)} BTC`;
    document.getElementById('inspOutflow').textContent = `${node.data.totalOutputBtc.toFixed(4)} BTC`;
  } else {
    document.getElementById('inspInflow').textContent = `${node.inflow.toFixed(4)} BTC`;
    document.getElementById('inspOutflow').textContent = `${node.outflow.toFixed(4)} BTC`;
  }
  
  // Network Context
  const netSec = document.getElementById('inspNetworkSection');
  if (node.type === 'transaction') {
    netSec.style.display = 'flex';
    document.getElementById('inspGeoAsn').textContent = `${node.data.geo_country} • ASN ${node.data.asn}`;
    document.getElementById('inspIpPort').textContent = `${node.data.src_ip}:${node.data.src_port} ➔ ${node.data.dst_ip}:${node.data.dst_port}`;
    document.getElementById('inspTimestamp').textContent = node.data.timestamp.replace('T', ' ').replace('Z', ' UTC');
  } else {
    netSec.style.display = 'none';
  }
  
  // UTXO list
  const utxoList = document.getElementById('inspUtxoList');
  utxoList.innerHTML = '';
  
  if (node.type === 'transaction') {
    document.getElementById('inspUtxoListTitle').textContent = 'Inputs & Outputs Breakdown';
    node.data.input_addresses.forEach((inAddr, idx) => {
      const row = document.createElement('div');
      row.className = 'utxo-row';
      row.innerHTML = `<span class="utxo-addr">IN: ${inAddr}</span><span class="utxo-amt text-danger">-${node.data.input_amounts[idx]?.toFixed(4)} BTC</span>`;
      row.querySelector('.utxo-addr').addEventListener('click', () => selectNode(inAddr));
      utxoList.appendChild(row);
    });
    node.data.output_addresses.forEach((outAddr, idx) => {
      const row = document.createElement('div');
      row.className = 'utxo-row';
      row.innerHTML = `<span class="utxo-addr">OUT: ${outAddr}</span><span class="utxo-amt text-success">+${node.data.output_amounts[idx]?.toFixed(4)} BTC</span>`;
      row.querySelector('.utxo-addr').addEventListener('click', () => selectNode(outAddr));
      utxoList.appendChild(row);
    });
  } else {
    document.getElementById('inspUtxoListTitle').textContent = 'Participating Transactions';
    node.data.inputTxs.forEach(txid => {
      const row = document.createElement('div');
      row.className = 'utxo-row';
      row.innerHTML = `<span class="utxo-addr">Spent in: ${txid}</span>`;
      row.querySelector('.utxo-addr').addEventListener('click', () => selectTx(txid));
      utxoList.appendChild(row);
    });
    node.data.outputTxs.forEach(txid => {
      const row = document.createElement('div');
      row.className = 'utxo-row';
      row.innerHTML = `<span class="utxo-addr">Received in: ${txid}</span>`;
      row.querySelector('.utxo-addr').addEventListener('click', () => selectTx(txid));
      utxoList.appendChild(row);
    });
  }
}

function openTxModal(tx) {
  const modal = document.getElementById('txModal');
  document.getElementById('modalTxid').textContent = tx.txid;
  document.getElementById('modalTypologyBadge').textContent = tx.primaryTypology;
  
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div class="insp-metrics-grid">
        <div class="insp-metric-box">
          <span class="metric-label">Timestamp</span>
          <span class="metric-val">${tx.timestamp}</span>
        </div>
        <div class="insp-metric-box">
          <span class="metric-label">Fee</span>
          <span class="metric-val">${tx.feeBtc.toFixed(6)} BTC</span>
        </div>
        <div class="insp-metric-box">
          <span class="metric-label">Relay Endpoints</span>
          <span class="metric-val font-mono">${tx.src_ip}:${tx.src_port} ➔ ${tx.dst_ip}:${tx.dst_port}</span>
        </div>
        <div class="insp-metric-box">
          <span class="metric-label">Routing Origin</span>
          <span class="metric-val">${tx.geo_country} • ASN ${tx.asn}</span>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="insp-section">
          <div class="section-title">Inputs (${tx.input_addresses.length}) • ${tx.totalInputBtc.toFixed(4)} BTC</div>
          <div class="utxo-list">
            ${tx.input_addresses.map((a, i) => `
              <div class="utxo-row">
                <span class="utxo-addr">${a}</span>
                <span class="utxo-amt text-danger">${tx.input_amounts[i]?.toFixed(4)} BTC</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="insp-section">
          <div class="section-title">Outputs (${tx.output_addresses.length}) • ${tx.totalOutputBtc.toFixed(4)} BTC</div>
          <div class="utxo-list">
            ${tx.output_addresses.map((a, i) => `
              <div class="utxo-row">
                <span class="utxo-addr">${a}</span>
                <span class="utxo-amt text-success">${tx.output_amounts[i]?.toFixed(4)} BTC</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

function shortenString(str, len) {
  if (!str || str.length <= len) return str;
  return str.slice(0, 5) + '..' + str.slice(-4);
}

// ==========================================================================
// Dataset Loader & Switcher
// ==========================================================================

function loadDataset(type, customData = null) {
  state.currentDataset = type;
  
  // Highlight dataset button
  document.querySelectorAll('.dataset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dataset === type);
  });
  
  let txList = [];
  let seedList = [];
  
  if (customData) {
    txList = customData.txs;
    seedList = customData.seeds || [];
  } else if (type === 'json') {
    txList = EMBEDDED_DATA.json.txs;
    seedList = EMBEDDED_DATA.json.seeds;
  } else if (type === 'csv') {
    txList = parseCsvData(EMBEDDED_DATA.csv.raw, EMBEDDED_DATA.csv.seeds);
    seedList = EMBEDDED_DATA.csv.seeds;
  } else if (type === 'xml') {
    txList = parseXmlData(EMBEDDED_DATA.xml.raw, EMBEDDED_DATA.xml.seeds);
    seedList = EMBEDDED_DATA.xml.seeds;
  }
  
  state.rawTransactions = txList;
  state.seedLabels = seedList;
  
  // Perform Forensic Analysis
  state.analyzedData = analyzeDataset(txList, seedList);
  
  // Update UI components
  updateKpiCards(state.analyzedData.metrics);
  updateTypologyBars(state.analyzedData.metrics.typologyCounts, state.analyzedData.metrics.totalTx);
  updateGeoBars(state.analyzedData.metrics.geoCounts, state.analyzedData.metrics.asnCounts, state.analyzedData.metrics.totalTx);
  updatePortStats(state.analyzedData.metrics.portCounts);
  updateTransactionsTable(state.analyzedData.transactions);
  
  // Rebuild Graph
  rebuildGraph();
  showToast(`Loaded ${type.toUpperCase()} Dataset (${txList.length} Transactions)`);
}

function rebuildGraph() {
  if (!state.analyzedData) return;
  
  const { nodes, edges, nodeMap } = buildGraphElements(
    state.analyzedData,
    state.viewMode,
    state.typologyFilter,
    state.riskFilter
  );
  
  state.nodes = nodes;
  state.edges = edges;
  state.nodeMap = nodeMap;
  
  document.getElementById('graphElementsCount').textContent = `${nodes.length} Nodes • ${edges.length} Edges`;
  
  if (state.layoutMode === 'hierarchical') {
    applyHierarchicalLayout(nodes, edges, state.analyzedData.transactions);
  }
  
  if (graphRenderer) {
    graphRenderer.fitToScreen();
  }
}

function applyFilters() {
  state.typologyFilter = document.getElementById('selectTypologyFilter').value;
  state.riskFilter = document.getElementById('selectRiskFilter').value;
  rebuildGraph();
  updateTransactionsTable(state.analyzedData.transactions);
}

// ==========================================================================
// Initialization & Event Binding
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('graphCanvas');
  const container = document.getElementById('graphViewport');
  graphRenderer = new GraphCanvasRenderer(canvas, container);
  graphRenderer.start();
  
  // 1. Initial Dataset Load
  loadDataset('json');
  
  // 2. Dataset Switcher Buttons
  document.getElementById('btnDsJson').addEventListener('click', () => loadDataset('json'));
  document.getElementById('btnDsCsv').addEventListener('click', () => loadDataset('csv'));
  document.getElementById('btnDsXml').addEventListener('click', () => loadDataset('xml'));
  
  // 3. View Mode Toggle
  document.getElementById('btnViewBipartite').addEventListener('click', e => {
    state.viewMode = 'bipartite';
    document.getElementById('btnViewBipartite').classList.add('active');
    document.getElementById('btnViewDirect').classList.remove('active');
    rebuildGraph();
  });
  
  document.getElementById('btnViewDirect').addEventListener('click', e => {
    state.viewMode = 'direct';
    document.getElementById('btnViewDirect').classList.add('active');
    document.getElementById('btnViewBipartite').classList.remove('active');
    rebuildGraph();
  });
  
  // 4. Layout Mode Toggle
  document.getElementById('btnLayoutForce').addEventListener('click', () => {
    state.layoutMode = 'force';
    state.physicsEnabled = true;
    document.getElementById('btnLayoutForce').classList.add('active');
    document.getElementById('btnLayoutHierarchical').classList.remove('active');
    document.getElementById('physicsIcon').textContent = '⏸️';
    rebuildGraph();
  });
  
  document.getElementById('btnLayoutHierarchical').addEventListener('click', () => {
    state.layoutMode = 'hierarchical';
    document.getElementById('btnLayoutHierarchical').classList.add('active');
    document.getElementById('btnLayoutForce').classList.remove('active');
    rebuildGraph();
  });
  
  // 5. Physics Freeze Toggle
  document.getElementById('btnFreezePhysics').addEventListener('click', () => {
    state.physicsEnabled = !state.physicsEnabled;
    document.getElementById('physicsIcon').textContent = state.physicsEnabled ? '⏸️' : '▶️';
    showToast(state.physicsEnabled ? 'Physics Simulation Resumed' : 'Physics Simulation Frozen');
  });
  
  // 6. Zoom & Fit Controls
  document.getElementById('btnZoomIn').addEventListener('click', () => {
    state.camera.zoom = Math.min(4.0, state.camera.zoom * 1.25);
  });
  document.getElementById('btnZoomOut').addEventListener('click', () => {
    state.camera.zoom = Math.max(0.15, state.camera.zoom * 0.8);
  });
  document.getElementById('btnFitGraph').addEventListener('click', () => {
    graphRenderer.fitToScreen();
  });
  document.getElementById('btnResetHighlights').addEventListener('click', () => {
    state.selectedNodeId = null;
    state.selectedTxId = null;
    state.highlightedNodes.clear();
    state.highlightedEdges.clear();
    state.traversalPath = null;
    document.getElementById('traversalBanner').style.display = 'none';
    document.getElementById('inspectorEmpty').style.display = 'flex';
    document.getElementById('inspectorDetails').style.display = 'none';
    updateTransactionsTable(state.analyzedData.transactions);
  });
  
  // 7. Trace Seed Path Action
  function triggerTraceSeed() {
    const targetId = state.selectedNodeId || (state.nodes[0] ? state.nodes[0].id : null);
    if (!targetId) {
      showToast('Select a node first to trace path to seed');
      return;
    }
    
    const result = traceShortestPathToSeed(targetId);
    if (result && result.path.length > 0) {
      state.traversalPath = result;
      state.highlightedNodes.clear();
      state.highlightedEdges = new Set(result.edgeIds);
      result.path.forEach(id => state.highlightedNodes.add(id));
      
      const banner = document.getElementById('traversalBanner');
      document.getElementById('traversalText').textContent = `Path from ${shortenString(targetId, 8)} to Illicit Seed Anchor (${result.hops} Hops)`;
      banner.style.display = 'flex';
      
      showToast(`Found path with ${result.hops} hops to illicit seed entity`);
    } else {
      showToast('No path to illicit seed anchor found for this node');
    }
  }
  
  document.getElementById('btnTraceSeedPath').addEventListener('click', triggerTraceSeed);
  document.getElementById('btnInspTraceSeed').addEventListener('click', triggerTraceSeed);
  
  document.getElementById('btnCloseBanner').addEventListener('click', () => {
    document.getElementById('traversalBanner').style.display = 'none';
    state.traversalPath = null;
  });
  
  // 8. Ancestors & Descendants Actions
  document.getElementById('btnInspTraceUpstream').addEventListener('click', () => {
    if (!state.selectedNodeId) return;
    const upstream = traceAncestors(state.selectedNodeId);
    state.highlightedNodes = upstream;
    state.highlightedEdges.clear();
    state.edges.forEach(e => {
      if (upstream.has(e.source) && upstream.has(e.target)) state.highlightedEdges.add(e.id);
    });
    showToast(`Highlighted ${upstream.size} upstream funding nodes`);
  });
  
  document.getElementById('btnInspTraceDownstream').addEventListener('click', () => {
    if (!state.selectedNodeId) return;
    const downstream = traceDescendants(state.selectedNodeId);
    state.highlightedNodes = downstream;
    state.highlightedEdges.clear();
    state.edges.forEach(e => {
      if (downstream.has(e.source) && downstream.has(e.target)) state.highlightedEdges.add(e.id);
    });
    showToast(`Highlighted ${downstream.size} downstream spending nodes`);
  });
  
  // 9. Quick Seed Inspect button in Inspector empty state
  document.getElementById('btnInspectSeedDirect').addEventListener('click', () => {
    const seed = state.seedLabels[0];
    if (seed && state.nodeMap.has(seed.address)) {
      selectNode(seed.address);
      graphRenderer.zoomToNode(state.nodeMap.get(seed.address));
    } else if (seed && seed.first_flagged_txid && state.nodeMap.has(seed.first_flagged_txid)) {
      selectNode(seed.first_flagged_txid);
      graphRenderer.zoomToNode(state.nodeMap.get(seed.first_flagged_txid));
    } else {
      showToast('Seed address not present in current visible filter');
    }
  });
  
  // 10. Filters & Search Handlers
  document.getElementById('selectTypologyFilter').addEventListener('change', applyFilters);
  document.getElementById('selectRiskFilter').addEventListener('change', applyFilters);
  
  document.getElementById('tableTypologySelect').addEventListener('change', () => {
    updateTransactionsTable(state.analyzedData.transactions);
  });
  document.getElementById('tableRiskSelect').addEventListener('change', () => {
    updateTransactionsTable(state.analyzedData.transactions);
  });
  document.getElementById('tableSearchInput').addEventListener('input', () => {
    updateTransactionsTable(state.analyzedData.transactions);
  });
  
  // Graph Search Input
  document.getElementById('graphSearchInput').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      state.highlightedNodes.clear();
      return;
    }
    
    let matched = null;
    state.highlightedNodes.clear();
    state.nodes.forEach(n => {
      if (n.fullLabel.toLowerCase().includes(q)) {
        state.highlightedNodes.add(n.id);
        if (!matched) matched = n;
      }
    });
    
    if (matched) {
      selectNode(matched.id);
      graphRenderer.zoomToNode(matched);
    }
  });
  
  document.getElementById('btnGraphSearchClear').addEventListener('click', () => {
    document.getElementById('graphSearchInput').value = '';
    state.highlightedNodes.clear();
  });
  
  // 11. Modal Controls
  document.getElementById('btnModalClose').addEventListener('click', () => {
    document.getElementById('txModal').style.display = 'none';
  });
  document.getElementById('btnInspOpenTxModal').addEventListener('click', () => {
    const node = state.nodeMap.get(state.selectedNodeId);
    if (node && node.type === 'transaction') {
      openTxModal(node.data);
    } else if (node && node.type === 'address') {
      const txid = node.data.outputTxs[0] || node.data.inputTxs[0];
      const tx = state.analyzedData.transactions.find(t => t.txid === txid);
      if (tx) openTxModal(tx);
    }
  });
  
  // 12. Custom File Upload Modal
  const uploadModal = document.getElementById('uploadModal');
  document.getElementById('btnUploadModal').addEventListener('click', () => {
    uploadModal.style.display = 'flex';
  });
  document.getElementById('btnUploadModalClose').addEventListener('click', () => {
    uploadModal.style.display = 'none';
  });
  
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  
  document.getElementById('btnBrowseFiles').addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleCustomFileUpload(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener('change', e => {
    if (e.target.files.length > 0) {
      handleCustomFileUpload(e.target.files[0]);
    }
  });
  
  function handleCustomFileUpload(file) {
    const reader = new FileReader();
    const name = file.name.toLowerCase();
    
    reader.onload = evt => {
      const content = evt.target.result;
      try {
        let txs = [];
        if (name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          txs = Array.isArray(parsed) ? parsed : (parsed.transactions || []);
        } else if (name.endsWith('.csv')) {
          txs = parseCsvData(content, []);
        } else if (name.endsWith('.xml')) {
          txs = parseXmlData(content, []);
        } else {
          showToast('Unsupported file format. Please upload .json, .csv, or .xml');
          return;
        }
        
        loadDataset('custom', { txs, seeds: state.seedLabels });
        uploadModal.style.display = 'none';
      } catch (err) {
        showToast('Error parsing file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
  
  // 13. Export Report as JSON
  document.getElementById('btnExportJson').addEventListener('click', () => {
    if (!state.analyzedData) return;
    const exportObj = {
      exportTimestamp: new Date().toISOString(),
      dataset: state.currentDataset,
      summary: state.analyzedData.metrics,
      seedLabels: state.seedLabels,
      transactions: state.analyzedData.transactions
    };
    
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitcoin_forensics_report_${state.currentDataset}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Forensic report exported successfully');
  });
});
