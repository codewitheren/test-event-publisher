#!/bin/bash

# Temel renkler
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Geçici klasör ve temizleme
TEMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "$TEMP_DIR"
  [ ! -z "$NODE_PID" ] && ps -p $NODE_PID > /dev/null && kill $NODE_PID 2>/dev/null
}
trap cleanup EXIT INT TERM

# Hızlı kurulum
cd "$TEMP_DIR"
echo  "${GREEN}⏳ Yükleniyor...${NC}"
git clone --quiet https://github.com/codewitheren/test-event-publisher.git && cd test-event-publisher
if [ $? -ne 0 ]; then echo  "${RED}❌ Hata${NC}"; exit 1; fi

npm install --silent
if [ $? -ne 0 ]; then echo  "${RED}❌ Hata${NC}"; exit 1; fi

# Port kontrolü
lsof -Pi :3737 -sTCP:LISTEN -t >/dev/null && echo  "${RED}⚠️ Port 3737 kullanımda!${NC}" && read -p "Enter..." 

# Tarayıcı aç ve çalıştır
if [[ "$OSTYPE" == "darwin"* ]]; then open http://localhost:3737 &
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then xdg-open http://localhost:3737 &>/dev/null &
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then start http://localhost:3737; fi

echo  "${GREEN}✓ Hazır - Tarayıcıda açıldı (Kapatmak için herhangi bir tuşa basın)${NC}"

# Başlat ve bekle
node app.js &
NODE_PID=$!
read -n 1