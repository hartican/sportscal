# -*- coding: utf-8 -*-
"""Independent artifact scanner: Python decoders, not the JS redactor."""
import base64,codecs,html,json,re,urllib.parse
def contains(blob,marker):
    patterns=[marker.encode(),marker.encode('utf-16le'),marker.encode('utf-16be'),base64.b64encode(marker.encode()),base64.urlsafe_b64encode(marker.encode()).rstrip(b'='),marker.encode().hex().encode()]
    if any(p in blob for p in patterns)or marker.encode().hex().encode()in blob.lower():return True
    pending=[blob.decode('utf-8',errors='replace')];seen=set()
    for level in range(18):
        next_values=[]
        for text in pending:
            if text in seen:continue
            seen.add(text)
            if any(p.decode('ascii',errors='ignore')in text for p in[patterns[0],*patterns[3:]])or marker.encode().hex()in text.lower():return True
            if '\\'not in text and '%'not in text and '&#'not in text:continue
            if '\\'in text:
                try:next_values.append(codecs.decode(text,'unicode_escape',errors='strict'))
                except(UnicodeError,ValueError):pass
                for token in re.findall(r'"(?:\\.|[^"\\])*"',text):
                    try:next_values.append(json.loads(token))
                    except(ValueError,UnicodeError):pass
            if '%'in text:next_values.append(urllib.parse.unquote(text))
            if '&#'in text:next_values.append(html.unescape(text))
        pending=[v for v in next_values if isinstance(v,str)and v not in seen]
        if not pending:break
    return False
def selftest(marker):
    values=[marker,base64.b64encode(marker.encode()).decode(),marker.encode().hex(),marker.encode().hex().upper(),urllib.parse.quote(marker,safe=''),''.join('%%%02x'%ord(c)for c in marker),''.join('&#%d;'%ord(c)for c in marker)]
    encoded=''.join('\\u%04x'%ord(c)for c in marker)
    for _ in range(5):values.append(encoded);encoded=json.dumps(encoded)
    assert all(contains(value.encode(),marker)for value in values),'SCANNER_ENCODING_CONTROL_FAILED'
