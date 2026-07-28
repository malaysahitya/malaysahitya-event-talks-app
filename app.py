from flask import Flask, render_template, jsonify, request
import urllib.request
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import time
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for feed data
feed_cache = {
    'data': None,
    'last_fetched': 0
}

CACHE_DURATION_SECONDS = 300  # 5 minutes cache default, refresh parameter overrides

def fetch_and_parse_feed():
    req = urllib.request.Request(FEED_URL, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    
    with urllib.request.urlopen(req, timeout=15) as response:
        xml_data = response.read()

    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}

    notes = []
    category_counts = {}

    for entry in root.findall('atom:entry', ns):
        entry_id = entry.findtext('atom:id', '', ns)
        date_title = entry.findtext('atom:title', '', ns)
        updated_iso = entry.findtext('atom:updated', '', ns)
        link_elem = entry.find('atom:link', ns)
        link = link_elem.attrib.get('href', '') if link_elem is not None else ''

        content_html = entry.findtext('atom:content', '', ns)
        soup = BeautifulSoup(content_html, 'html.parser')

        sections = []
        current_type = "General"
        current_html_parts = []

        for elem in soup.children:
            if elem.name == 'h3':
                if current_html_parts:
                    raw_html = "".join(current_html_parts).strip()
                    clean_text = BeautifulSoup(raw_html, 'html.parser').get_text(separator=' ').strip()
                    clean_text = " ".join(clean_text.split())
                    if clean_text:
                        sections.append({
                            'id': f"{entry_id}-sec-{len(sections)}",
                            'type': current_type,
                            'html': raw_html,
                            'text': clean_text
                        })
                        category_counts[current_type] = category_counts.get(current_type, 0) + 1
                    current_html_parts = []
                current_type = elem.get_text(strip=True)
            elif elem.name:
                current_html_parts.append(str(elem))

        if current_html_parts:
            raw_html = "".join(current_html_parts).strip()
            clean_text = BeautifulSoup(raw_html, 'html.parser').get_text(separator=' ').strip()
            clean_text = " ".join(clean_text.split())
            if clean_text:
                sections.append({
                    'id': f"{entry_id}-sec-{len(sections)}",
                    'type': current_type,
                    'html': raw_html,
                    'text': clean_text
                })
                category_counts[current_type] = category_counts.get(current_type, 0) + 1

        notes.append({
            'id': entry_id,
            'date': date_title,
            'updated': updated_iso,
            'link': link,
            'sections': sections
        })

    return {
        'notes': notes,
        'total_entries': len(notes),
        'total_sections': sum(len(n['sections']) for n in notes),
        'categories': category_counts,
        'fetched_at': time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()

    if force_refresh or not feed_cache['data'] or (now - feed_cache['last_fetched'] > CACHE_DURATION_SECONDS):
        try:
            parsed_data = fetch_and_parse_feed()
            feed_cache['data'] = parsed_data
            feed_cache['last_fetched'] = now
            return jsonify({
                'status': 'success',
                'refreshed': True,
                'data': parsed_data
            })
        except Exception as e:
            app.logger.error(f"Error fetching feed: {e}")
            if feed_cache['data']:
                return jsonify({
                    'status': 'warning',
                    'message': f"Failed to fetch fresh data ({str(e)}). Serving cached version.",
                    'refreshed': False,
                    'data': feed_cache['data']
                })
            return jsonify({
                'status': 'error',
                'message': f"Failed to fetch release notes: {str(e)}"
            }), 500

    return jsonify({
        'status': 'success',
        'refreshed': False,
        'data': feed_cache['data']
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
