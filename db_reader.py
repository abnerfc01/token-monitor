import sqlite3
import glob
import re
import json
import os
import sys

def decode_varint(data, pos):
    val = 0
    shift = 0
    while True:
        b = data[pos]
        val |= (b & 0x7f) << shift
        pos += 1
        if not (b & 0x80):
            break
        shift += 7
    return val, pos

def parse_proto(data):
    pos = 0
    res = {}
    if not data:
        return res
    while pos < len(data):
        key, pos = decode_varint(data, pos)
        field_num = key >> 3
        wire_type = key & 7
        if field_num <= 0 or field_num > 50000 or wire_type not in (0, 1, 2, 5):
            raise ValueError('Invalid field')
        if wire_type == 0:
            val, pos = decode_varint(data, pos)
            res[field_num] = val
        elif wire_type == 1:
            val = int.from_bytes(data[pos:pos+8], 'little')
            pos += 8
            res[field_num] = val
        elif wire_type == 2:
            length, pos = decode_varint(data, pos)
            val = data[pos:pos+length]
            pos += length
            try:
                res[field_num] = parse_proto(val)
            except Exception:
                res[field_num] = val
        elif wire_type == 5:
            val = int.from_bytes(data[pos:pos+4], 'little')
            pos += 4
            res[field_num] = val
    return res

def decode_string(val):
    if isinstance(val, bytes):
        try:
            return val.decode('utf-8', errors='ignore')
        except Exception:
            return ""
    return str(val) if val is not None else ""

def get_db_stats():
    conversations_dir = '/home/abnerfc01/.gemini/antigravity-cli/conversations'
    results = []
    
    db_paths = glob.glob(os.path.join(conversations_dir, '*.db'))
    for path in db_paths:
        db_id = os.path.basename(path).replace('.db', '')
        try:
            conn = sqlite3.connect(path)
            cursor = conn.cursor()
            
            # Get workspace path
            cursor.execute('SELECT data FROM trajectory_metadata_blob WHERE id="main"')
            row = cursor.fetchone()
            workspace = ""
            if row:
                uris = re.findall(b'file://[a-zA-Z0-9_\\-\\./]+', row[0])
                if uris:
                    workspace = uris[0].decode('ascii')
            
            # If workspace path is not found, fallback to checking parent folders or empty
            if not workspace:
                workspace = "file:///home/abnerfc01"
                
            # Get conversation start time from file creation/mtime as fallback
            # but try to get it from step 0
            start_time = int(os.path.getmtime(path))
            try:
                cursor.execute('SELECT metadata FROM steps WHERE idx=0')
                row_step = cursor.fetchone()
                if row_step and row_step[0]:
                    s_proto = parse_proto(row_step[0])
                    # step timestamp is in key 1 -> 1
                    t_sec = s_proto.get(1, {}).get(1, 0)
                    if t_sec > 0:
                        start_time = t_sec
            except Exception:
                pass
                
            # Get all gen_metadata records
            cursor.execute('SELECT data FROM gen_metadata ORDER BY idx ASC')
            generations = []
            for (data,) in cursor.fetchall():
                try:
                    proto = parse_proto(data)
                    k1 = proto.get(1, {})
                    
                    # Model details
                    model_raw = k1.get(21, "")
                    model_code_raw = k1.get(19, "")
                    model_name = decode_string(model_raw)
                    model_code = decode_string(model_code_raw)
                    
                    # Token usage
                    usage = k1.get(17, {}).get(2, {})
                    if not usage:
                        usage = k1.get(4, {})
                        
                    out_tokens = usage.get(1, 0)
                    in_tokens = usage.get(2, 0)
                    cached_tokens = usage.get(5, 0)
                    
                    # Step timestamp
                    step_ts = k1.get(9, {}).get(4, {}).get(1, start_time)
                    
                    generations.append({
                        "model": model_name or model_code or "Unknown Model",
                        "model_code": model_code,
                        "input_tokens": in_tokens,
                        "output_tokens": out_tokens,
                        "cached_tokens": cached_tokens,
                        "timestamp": step_ts
                    })
                except Exception:
                    # Skip corrupted generation rows
                    pass
            
            # File metadata
            file_size = os.path.getsize(path)
            last_modified = int(os.path.getmtime(path))
            
            results.append({
                "conversation_id": db_id,
                "workspace": workspace,
                "start_time": start_time,
                "last_modified": last_modified,
                "file_size": file_size,
                "generations": generations,
                "steps_count": len(generations)
            })
            
            conn.close()
        except Exception as e:
            # Print error to stderr so it doesn't mess with JSON output
            sys.stderr.write(f"Error parsing database {path}: {str(e)}\n")
            
    return results

if __name__ == "__main__":
    stats = get_db_stats()
    print(json.dumps(stats, indent=2))
