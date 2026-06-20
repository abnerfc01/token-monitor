import sqlite3
import glob
import re
import json
import os
import sys

# Load environment variables from .env file if it exists
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    parts = line.split('=', 1)
                    if len(parts) == 2:
                        key = parts[0].strip()
                        val = parts[1].strip()
                        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                            val = val[1:-1]
                        os.environ[key] = val
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to load .env file: {str(e)}\n")

# Load environment configuration
load_env()

# Protobuf decoding helpers (used for Antigravity)
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


# --- Adapter Interface & Implementations ---

class BaseAdapter:
    def __init__(self, name):
        self.name = name

    def get_stats(self):
        raise NotImplementedError("Subclasses must implement get_stats()")


class AntigravityAdapter(BaseAdapter):
    """
    Adapter for Google Antigravity / AIOX (both CLI and IDE databases).
    """
    def __init__(self):
        super().__init__("Antigravity / AIOX")
        home_dir = os.path.expanduser('~')
        self.conversations_dirs = [
            os.path.join(home_dir, '.gemini/antigravity-cli/conversations'),
            os.path.join(home_dir, '.gemini/antigravity-ide/conversations')
        ]
        
        # Add support for custom/additional conversation directories (e.g. from other machines)
        additional_dirs = os.environ.get('ADDITIONAL_CONVERSATIONS_DIRS', '')
        if additional_dirs:
            for d in additional_dirs.split(','):
                d = d.strip()
                if d:
                    expanded_path = os.path.expanduser(os.path.expandvars(d))
                    self.conversations_dirs.append(expanded_path)

    def get_stats(self):
        results = []
        db_paths = []
        for c_dir in self.conversations_dirs:
            if os.path.exists(c_dir):
                db_paths.extend(glob.glob(os.path.join(c_dir, '*.db')))
                
        # Use set to avoid processing duplicate databases if folders overlap
        processed_paths = set()
        for path in db_paths:
            abs_path = os.path.abspath(path)
            if abs_path in processed_paths:
                continue
            processed_paths.add(abs_path)
            
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
                
                if not workspace:
                    home_dir = os.path.expanduser('~')
                    workspace = f"file://{home_dir}"
                    
                start_time = int(os.path.getmtime(path))
                try:
                    cursor.execute('SELECT metadata FROM steps WHERE idx=0')
                    row_step = cursor.fetchone()
                    if row_step and row_step[0]:
                        s_proto = parse_proto(row_step[0])
                        t_sec = s_proto.get(1, {}).get(1, 0)
                        if t_sec > 0:
                            start_time = t_sec
                except Exception:
                    pass
                    
                cursor.execute('SELECT data FROM gen_metadata ORDER BY idx ASC')
                generations = []
                for (data,) in cursor.fetchall():
                    try:
                        proto = parse_proto(data)
                        k1 = proto.get(1, {})
                        
                        model_raw = k1.get(21, "")
                        model_code_raw = k1.get(19, "")
                        model_name = decode_string(model_raw)
                        model_code = decode_string(model_code_raw)
                        
                        usage = k1.get(17, {}).get(2, {})
                        if not usage:
                            usage = k1.get(4, {})
                            
                        out_tokens = usage.get(1, 0)
                        in_tokens = usage.get(2, 0)
                        cached_tokens = usage.get(5, 0)
                        
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
                        pass
                
                referenced_paths = set()
                try:
                    cursor.execute('SELECT step_payload, metadata FROM steps')
                    for payload, metadata in cursor.fetchall():
                        for blob in (payload, metadata):
                            if blob:
                                matches = re.findall(rb'"(?:Cwd|TargetFile|AbsolutePath|Target|DirectoryPath)"\s*:\s*"([^"]+)"', blob)
                                for m in matches:
                                    try:
                                        path_str = m.decode('utf-8', errors='ignore')
                                        if path_str.startswith('/home/') and len(path_str) > 14:
                                            referenced_paths.add(path_str)
                                    except Exception:
                                        pass
                except Exception:
                    pass

                file_size = os.path.getsize(path)
                last_modified = int(os.path.getmtime(path))
                
                # Check machine origin (useful when database files are copied from other machines)
                # We can tag the conversation_id with the database origin directory name if it represents another machine
                dir_name = os.path.basename(os.path.dirname(path))
                machine_prefix = ""
                if dir_name not in ('conversations', 'cli', 'ide'):
                    machine_prefix = f"{dir_name}-"

                results.append({
                    "conversation_id": f"{machine_prefix}{db_id}",
                    "workspace": workspace,
                    "start_time": start_time,
                    "last_modified": last_modified,
                    "file_size": file_size,
                    "generations": generations,
                    "steps_count": len(generations),
                    "referenced_paths": list(referenced_paths)
                })
                
                conn.close()
            except Exception as e:
                sys.stderr.write(f"Error parsing Antigravity database {path}: {str(e)}\n")
        return results


class ClaudeCodeAdapter(BaseAdapter):
    """
    Adapter for Anthropic's Claude Code CLI.
    """
    def __init__(self):
        super().__init__("Claude Code")
        home_dir = os.path.expanduser('~')
        self.search_paths = [
            os.path.join(home_dir, '.config/claude-code'),
            os.path.join(home_dir, '.claude-code'),
            os.path.join(home_dir, '.claude/sessions')
        ]

    def get_stats(self):
        results = []
        for base_path in self.search_paths:
            if not os.path.exists(base_path):
                continue
            
            json_files = glob.glob(os.path.join(base_path, '*.json'))
            for f in json_files:
                try:
                    with open(f, 'r', encoding='utf-8') as file_obj:
                        data = json.load(file_obj)
                        if isinstance(data, dict) and "history" in data:
                            pass
                except Exception as e:
                    sys.stderr.write(f"Error parsing Claude Code JSON {f}: {str(e)}\n")
        return results


class AiderAdapter(BaseAdapter):
    """
    Adapter for Aider CLI.
    """
    def __init__(self):
        super().__init__("Aider CLI")
        home_dir = os.path.expanduser('~')
        # Load PROJECTS_ROOT from environment variable or default to ~/src
        projects_root = os.environ.get('PROJECTS_ROOT', os.path.join(home_dir, 'src'))
        projects_root = os.path.expanduser(os.path.expandvars(projects_root))
        self.search_pattern = os.path.join(projects_root, '**/.aider.chat.history.md')

    def get_stats(self):
        results = []
        try:
            files = glob.glob(self.search_pattern, recursive=True)
        except Exception as e:
            sys.stderr.write(f"AiderAdapter: failed to scan directory: {str(e)}\n")
            return results
            
        for f in files:
            try:
                workspace_path = os.path.dirname(f)
                workspace_uri = f"file://{workspace_path}"
                mtime = int(os.path.getmtime(f))
                file_size = os.path.getsize(f)
                
                with open(f, 'r', encoding='utf-8') as file_obj:
                    content = file_obj.read()
                    
                turns = content.split('####')
                steps_count = max(0, len(turns) - 1)
                
                char_count = len(content)
                estimated_tokens = char_count // 4
                
                generations = []
                if steps_count > 0:
                    tokens_per_step = estimated_tokens // steps_count
                    for idx in range(steps_count):
                        generations.append({
                            "model": "Claude 3.5 Sonnet",
                            "model_code": "claude-3-5-sonnet",
                            "input_tokens": int(tokens_per_step * 0.7),
                            "output_tokens": int(tokens_per_step * 0.3),
                            "cached_tokens": 0,
                            "timestamp": mtime
                        })
                
                results.append({
                    "conversation_id": f"aider-{abs(hash(f))}",
                    "workspace": workspace_uri,
                    "start_time": mtime - (steps_count * 60),
                    "last_modified": mtime,
                    "file_size": file_size,
                    "generations": generations,
                    "steps_count": steps_count,
                    "referenced_paths": [f]
                })
            except Exception as e:
                sys.stderr.write(f"Error parsing Aider history {f}: {str(e)}\n")
        return results


# --- Orchestration / Aggregator ---

def get_db_stats():
    adapters = [
        AntigravityAdapter(),
        ClaudeCodeAdapter(),
        AiderAdapter()
    ]
    
    all_results = []
    for adapter in adapters:
        try:
            stats = adapter.get_stats()
            if stats:
                all_results.extend(stats)
        except Exception as e:
            sys.stderr.write(f"Adapter {adapter.name} failed: {str(e)}\n")
            
    all_results.sort(key=lambda x: x.get('last_modified', 0), reverse=True)
    return all_results

if __name__ == "__main__":
    stats = get_db_stats()
    print(json.dumps(stats, indent=2))
