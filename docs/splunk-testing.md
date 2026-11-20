---
layout: docs
title: "Splunk Testing"
permalink: /docs/splunk-testing/
---

{% raw %}
This guide explains how to generate comprehensive test data for Splunk.

## Overview

The testing framework includes:
- **Test Data Generator**: Creates realistic security events
- **280 Security Events**: Covering 7 attack categories

## Test Data Categories

The generator creates the following types of security events:

| Category | Count | Description |
|----------|-------|-------------|
| **Brute Force** | 50 | Failed authentication attempts from external IPs |
| **Malware** | 30 | Antivirus detections with file hashes |
| **C2 Traffic** | 100 | Command & control beaconing to malicious domains |
| **Data Exfiltration** | 20 | Large data transfers to external domains |
| **Privilege Escalation** | 15 | User account manipulation and admin access |
| **Lateral Movement** | 25 | Network logons and remote access |
| **Reconnaissance** | 40 | Port scanning and service enumeration |
| **Total** | **280** | |

## Generated IOCs (Indicators of Compromise)

Each event includes realistic indicators:

- **8 External Attacker IPs** (non-RFC1918)
- **8 Internal Victim IPs** (RFC1918)
- **8 Malicious Domains** (C2 servers, phishing sites, etc.)
- **7 Compromised Usernames**
- **6 Affected Hostnames**
- **Multiple File Hashes** (MD5, SHA256)
- **MITRE ATT&CK Mappings** (tactics and techniques)

## Quick Start

### Method 1: Generate Data Only (JSON File)

Generate test data and save to a JSON file:

```bash
python scripts/generate_splunk_test_data.py
```

This creates `splunk_test_data.json` with 280 events.

**Import into Splunk manually:**
1. Go to Splunk Web → Settings → Add Data → Upload
2. Select `splunk_test_data.json`
3. Set sourcetype to `json`
4. Choose your index (e.g., `main`)
5. Review and submit

### Method 2: Send Directly to Splunk HEC

Send test data directly to Splunk via HTTP Event Collector:

```bash
python scripts/generate_splunk_test_data.py \
    --send-to-splunk \
    --hec-url https://your-splunk-server:8088/services/collector \
    --hec-token your-hec-token-here \
    --index main \
    --no-verify-ssl
```

**Prerequisites:**
1. Enable HTTP Event Collector in Splunk:
   - Settings → Data Inputs → HTTP Event Collector
   - Click "Global Settings" → Enable
   - Create a new token
2. Note the HEC URL and token

## Script Reference

### generate_splunk_test_data.py

Generates realistic security event data for Splunk.

**Usage:**
```bash
python scripts/generate_splunk_test_data.py [options]
```

**Options:**
- `-o, --output FILE`: Output JSON file (default: `splunk_test_data.json`)
- `--send-to-splunk`: Send data directly to Splunk HEC
- `--hec-url URL`: Splunk HEC URL
- `--hec-token TOKEN`: Splunk HEC authentication token
- `--index INDEX`: Target Splunk index (default: `main`)
- `--no-verify-ssl`: Disable SSL verification

**Examples:**

```bash
# Generate data to file
python scripts/generate_splunk_test_data.py -o test_events.json

# Send to Splunk
python scripts/generate_splunk_test_data.py \
    --send-to-splunk \
    --hec-url https://splunk.example.com:8088/services/collector \
    --hec-token abcd1234-5678-90ef-ghij-klmnopqrstuv \
    --index security_test \
    --no-verify-ssl
```

## Complete Workflow Example

Here's a complete end-to-end testing workflow:

### Step 1: Setup Environment

```bash
# Ensure database is running
docker compose -f infra/docker/docker-compose.yml up -d postgres

# Configure Splunk credentials via the web UI:
#   Settings → Integrations → Splunk
# For headless/CI runs you can still export Splunk env vars:
export SPLUNK_URL=https://your-splunk-server:8089
export SPLUNK_USERNAME=admin
export SPLUNK_PASSWORD=your_password
```

### Step 2: Generate and Upload Test Data

```bash
# Generate 280 security events
python scripts/generate_splunk_test_data.py

# Upload to Splunk (manual or HEC)
# Option A: Manual upload via Splunk Web UI
# Option B: Send via HEC
python scripts/generate_splunk_test_data.py \
    --send-to-splunk \
    --hec-url https://splunk:8088/services/collector \
    --hec-token YOUR_TOKEN \
    --no-verify-ssl
```

### Step 3: View in UI

```bash
# Start the web interface
./start.sh

# Navigate to:
# http://localhost:6988
#
# View:
# - Cases → Select your test case
```

## Testing Different Scenarios

### Scenario 1: Brute Force Attack

Generate only brute force events:

```python
from scripts.generate_splunk_test_data import SplunkTestDataGenerator

generator = SplunkTestDataGenerator()
events = generator.generate_brute_force_events(100)
generator.save_to_file(events, "brute_force_test.json")
```

### Scenario 2: APT (Advanced Persistent Threat)

Generate full attack chain:

```python
generator = SplunkTestDataGenerator()
events = []
events.extend(generator.generate_reconnaissance_events(50))
events.extend(generator.generate_brute_force_events(30))
events.extend(generator.generate_privilege_escalation_events(20))
events.extend(generator.generate_lateral_movement_events(40))
events.extend(generator.generate_c2_traffic_events(100))
events.extend(generator.generate_data_exfiltration_events(30))
generator.save_to_file(events, "apt_attack.json")
```

### Scenario 3: Ransomware Attack

Focus on malware and C2:

```python
generator = SplunkTestDataGenerator()
events = []
events.extend(generator.generate_malware_events(50))
events.extend(generator.generate_c2_traffic_events(200))
events.extend(generator.generate_lateral_movement_events(30))
generator.save_to_file(events, "ransomware.json")
```

## Troubleshooting

### Splunk Connection Issues

```bash
# Test Splunk connection (resolves the Settings-stored config the
# same way the Splunk tool itself does)
python -c "
from core.integrations.splunk.tool import get_splunk_service

splunk = get_splunk_service()
if splunk is None:
    print('Connection: Splunk is not configured')
else:
    success, msg = splunk.test_connection()
    print(f'Connection: {msg}')
"
```

### No Events Returned from Splunk

Possible causes:
1. Data not yet indexed (wait 1-2 minutes)
2. Wrong index specified
3. Time range too narrow
4. Splunk search permissions

**Solution:**
```bash
# Check if data is in Splunk
# In Splunk Web, run:
index=main sourcetype=json | head 100

# Or widen the time range of your Splunk search.
```

### Claude API Errors

```bash
# Check API key
python -c "
from core.llm.harness.claude import ClaudeService
claude = ClaudeService()
if claude.has_api_key():
    print('✓ API key configured')
else:
    print('✗ API key missing')
"
```

## Event Structure

Each generated event has a consistent structure:

```json
{
  "_time": "2026-01-21T10:30:45",
  "sourcetype": "WinEventLog:Security",
  "source": "XmlWinEventLog:Security",
  "host": "WORKSTATION-10",
  "signature": "An account failed to log on",
  "severity": "high",
  "urgency": "high",
  "src": "185.220.101.45",
  "src_ip": "185.220.101.45",
  "dest": "10.0.1.15",
  "dest_ip": "10.0.1.15",
  "user": "jsmith",
  "action": "failure",
  "rule_name": "Multiple Failed Logon Attempts",
  "rule_title": "Brute Force Attack Detected",
  "rule_description": "Multiple failed logon attempts detected",
  "category": "Authentication",
  "subcategory": "Brute Force",
  "mitre_tactic": "Credential Access",
  "mitre_technique": "T1110.003",
  "priority": "high",
  "_raw": "..."
}
```

## MITRE ATT&CK Coverage

The test data covers these MITRE ATT&CK tactics:

| Tactic | Technique | Event Count |
|--------|-----------|-------------|
| Credential Access | T1110.003 | 50 |
| Execution | T1059.001 | 30 |
| Command and Control | T1071.001 | 100 |
| Exfiltration | T1041 | 20 |
| Privilege Escalation | T1134 | 15 |
| Lateral Movement | T1021.001 | 25 |
| Discovery | T1046 | 40 |
| **Total** | | **280** |

## Best Practices

1. **Use Dedicated Test Index**: Create a separate Splunk index for test data
   ```bash
   # In Splunk Web:
   Settings → Indexes → New Index → "test_security"
   ```

2. **Time-bound Tests**: Limit the time range of your Splunk searches when testing.

3. **Clean Up Test Data**: Remove test cases after testing
   ```bash
   # Delete test cases via API or UI
   curl -X DELETE http://localhost:6987/api/cases/<case_id>
   ```

4. **Reuse Generated Data**: Reuse an existing generated JSON file instead of regenerating, and test with smaller datasets first.

5. **Verify Results**: Always check the generated file
   ```bash
   cat splunk_test_data.json | jq 'length'
   ```

## Next Steps

After successful testing:

1. **Configure Real Data Sources**: Set up actual SIEM integrations
2. **Create Custom Alerts**: Use the test data patterns to create detection rules
3. **Train Your Team**: Use test cases for analyst training
4. **Benchmark Performance**: Measure generation and indexing times
5. **Iterate**: Adjust test data to match your environment

## Support

For issues or questions:
- Check logs: `logs/backend.log`, `logs/daemon.log`
- Review the site's integrations documentation
- Open an issue on GitHub

---

**Happy Testing! 🚀**
{% endraw %}
