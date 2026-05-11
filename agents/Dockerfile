FROM python:3.12-slim

WORKDIR /app/agents

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5050

CMD ["python", "-m", "app.server"]
