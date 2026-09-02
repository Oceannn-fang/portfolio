import requests
r = requests.get('https://upee.substack.com/p/best-da-butt-music-of-all-time', headers={'User-Agent': 'Mozilla/5.0'})
print(r.text[:10000])
