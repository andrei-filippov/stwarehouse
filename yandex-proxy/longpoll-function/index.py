"""
Yandex Cloud Function for Long Polling proxy to Supabase.
Replaces constant polling with event-driven updates.

How it works:
1. Client makes HTTP request to this function
2. Function checks for database changes every second
3. If changes found → returns immediately
4. If no changes for 30 seconds → returns empty response
5. Client immediately makes new request

This reduces requests from 1 per 5 seconds to ~1 per 30-60 seconds.
"""

import json
import os
import time
import requests
from datetime import datetime, timezone

# Supabase config from environment
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY')

# Tables to monitor (add your tables here)
TABLES = [
    'checklists',
    'checklist_items', 
    'equipment_kits',
    'kit_items',
    'cable_inventory',
    'cable_movements',
    'equipment_repairs',
    'inventory_items',
    'estimates',
    'estimate_items',
    'customers',
    'contracts'
]

MAX_WAIT_SECONDS = 30
CHECK_INTERVAL = 1


def get_table_timestamp(table: str, company_id: str = None) -> str:
    """Get the latest updated_at timestamp from a table."""
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
            'Accept': 'application/json'
        }
        
        params = {
            'select': 'updated_at',
            'order': 'updated_at.desc',
            'limit': 1
        }
        
        if company_id:
            params['company_id'] = f'eq.{company_id}'
        
        response = requests.get(url, headers=headers, params=params, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return data[0].get('updated_at', '')
    except Exception as e:
        print(f"Error checking {table}: {e}")
    
    return None


def handler(event, context):
    """Main Yandex Cloud Function handler."""
    
    # Parse request body
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except:
            pass
    
    # Get parameters
    last_timestamps = body.get('lastTimestamps', {})
    company_id = body.get('companyId')
    tables = body.get('tables', TABLES)
    
    # Wait for changes (up to MAX_WAIT_SECONDS)
    start_time = time.time()
    
    while time.time() - start_time < MAX_WAIT_SECONDS:
        changes = {}
        
        for table in tables:
            if table not in TABLES:
                continue
                
            last_time = last_timestamps.get(table, '1970-01-01')
            current_time = get_table_timestamp(table, company_id)
            
            if current_time and current_time > last_time:
                changes[table] = current_time
        
        # If changes found, return immediately
        if changes:
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                'body': json.dumps({
                    'changed': True,
                    'changes': changes,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                })
            }
        
        # Wait before next check
        time.sleep(CHECK_INTERVAL)
    
    # No changes within timeout
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        'body': json.dumps({
            'changed': False,
            'changes': {},
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    }
