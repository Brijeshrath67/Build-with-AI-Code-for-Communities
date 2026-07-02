# 🏥 PHC Exchange

> **An AI-Powered Medicine Redistribution Platform for Primary Health Centres**

PHC Exchange is an intelligent healthcare logistics platform designed to reduce medicine shortages and wastage across government Primary Health Centres (PHCs). The system enables PHCs with surplus medicines to share inventory with nearby centres experiencing shortages, using AI-driven demand forecasting, inventory management, and smart redistribution.

---

## 📖 Problem Statement

Government Primary Health Centres often face two critical challenges:

* Medicines frequently go **out of stock**, affecting patient care.
* Large quantities of medicines **expire unused** due to uneven distribution.

Traditional procurement relies heavily on central warehouses, leading to delays, inefficient inventory utilization, and increased wastage.

PHC Exchange addresses these issues by creating a collaborative network where nearby PHCs can exchange medicines before shortages occur or stock expires.

---

## 🚀 Solution

PHC Exchange acts as a **smart medicine exchange network** between PHCs.

Instead of immediately requesting medicines from a warehouse, the platform:

1. Monitors medicine inventory across PHCs.
2. Predicts future shortages using AI.
3. Detects nearby PHCs with surplus stock.
4. Recommends optimal medicine transfers.
5. Tracks every exchange with complete audit history.

This ensures medicines reach patients faster while significantly reducing wastage.

---

# ✨ Key Features

## 📦 Inventory Management

* Real-time medicine inventory
* Stock updates
* Batch & expiry tracking
* Low-stock notifications
* Offline data synchronization
* Import & Export support

---

## 🤖 AI Demand Forecasting

Predict future medicine requirements using:

* Historical consumption
* Seasonal trends
* Population served
* Disease patterns
* Current inventory levels

The AI proactively alerts PHCs before shortages occur.

---

## 🔄 Smart Medicine Redistribution

Automatically identifies:

* PHCs with surplus medicines
* PHCs facing shortages
* Best redistribution candidates
* Recommended transfer quantities
* Nearest eligible health centres

---

## 🗺️ GIS & Location Intelligence

* Locate nearby PHCs
* Distance-aware redistribution
* Regional inventory visualization

---

## 💬 AI Assistant

An intelligent assistant capable of:

* Understanding natural language queries
* Processing WhatsApp inventory updates
* Generating inventory summaries
* Answering stock-related questions
* Creating district-level reports

Example:

> "Which nearby PHC has excess Paracetamol?"

or

> "Which medicines are likely to expire this week?"

---

## 📊 Dashboards

### PHC Dashboard

* Current inventory
* Shortage alerts
* Transfer requests
* Incoming medicines
* Outgoing medicines

### District Dashboard

* Live monitoring of all PHCs
* Stock availability
* Redistribution analytics
* Shortage hotspots
* Performance reports

---

## 🔐 Secure Audit Trail

Every medicine transfer records:

* Sender PHC
* Receiver PHC
* Medicine details
* Quantity transferred
* Approval information
* Timestamp

Ensuring transparency and accountability.

---

# 🏗️ System Workflow

```text
Medicine Stock Updated
          │
          ▼
 AI Predicts Future Demand
          │
          ▼
 Detect Shortages & Surplus
          │
          ▼
 Find Nearby PHCs
          │
          ▼
 Recommend Redistribution
          │
          ▼
 Staff Approval
          │
          ▼
 Medicine Transfer
          │
          ▼
 Inventory Updated
```

---

# 👥 Users

| Role                    | Responsibilities                            |
| ----------------------- | ------------------------------------------- |
| ASHA Worker             | Update medicine inventory                   |
| PHC Staff               | Manage inventory & approve transfers        |
| District Health Officer | Monitor district-wide medicine distribution |
| Administrator           | Manage users, PHCs and system configuration |

---

# 💡 Example Scenario

### Before PHC Exchange

* PHC A has only **20 Paracetamol tablets** left.
* PHC B has **800 extra tablets**.
* PHC A requests stock from the central warehouse.
* Delivery takes several days.

---

### With PHC Exchange

* AI predicts PHC A will run out of stock in 3 days.
* System detects PHC B has surplus inventory.
* Platform recommends transferring 200 tablets.
* Staff approve the request.
* Medicines arrive within hours instead of days.

---

# 🌟 Benefits

* ✅ Reduces medicine shortages
* ✅ Minimizes medicine expiry and wastage
* ✅ Faster redistribution between PHCs
* ✅ AI-powered shortage prediction
* ✅ Supports offline operation
* ✅ Transparent audit trail
* ✅ Improved healthcare delivery in rural areas

---

# 🛠️ Tech Stack

## Frontend
* Next.js 14, React, TypeScript, Tailwind CSS, Leaflet

## Backend
* FastAPI, Python 3.13, SQLAlchemy, PostgreSQL, Redis

## AI/ML
* Scikit-learn, NumPy, Pandas, Groq API, Google Generative AI

## DevOps
* Docker, Docker Compose

---

# 🚀 Quick Start

## Prerequisites
- Python 3.13+
- Node.js 20+
- PostgreSQL 16
- Redis 7
- Docker (optional)

## Run with Docker (recommended)

```bash
cd NAME
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

## Run locally

```bash
# 1. Start PostgreSQL and Redis
docker compose -f infrastructure/docker/docker-compose.yml up db redis

# 2. Install Python dependencies
uv sync

# 3. Start API service (terminal 1)
uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000 --reload

# 4. Start AI service (terminal 2)
cd apps/ai-service
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# 5. Start Web frontend (terminal 3)
cd apps/web && npm install && npm run dev
```

Visit **http://localhost:3000** and login with any demo account (password: `password123`).

## Demo Accounts

| Name | Phone | Role |
|------|-------|------|
| Dr. Ramesh | 7777777777 | PHC Staff (Unit-9) |
| Dr. Suresh | 6666666666 | PHC Staff (Unit-3) |
| Dr. Verma | 6666666661 | PHC Staff (Nelamangala) |
| Dr. Patel | 6666666662 | PHC Staff (Devanahalli) |
| Asha Devi | 8888888888 | ASHA Worker |
| District Officer Gupta | 5555555555 | District Health Official |
| System Admin | 9999999999 | System Admin |

---

# 📂 Project Structure

```bash
NAME/
├── apps/
│   ├── api/            # FastAPI backend (port 8000)
│   ├── ai-service/     # AI microservice (port 8001)
│   ├── event-bus/      # Redis stream pub/sub library
│   └── web/            # Next.js frontend (port 3000)
├── database/
│   ├── schema.sql      # Database schema
│   └── seed/seed.sql   # Seed data
├── infrastructure/docker/
│   ├── docker-compose.yml
│   ├── backend.Dockerfile
│   ├── ai.Dockerfile
│   └── frontend.Dockerfile
├── docs/               # Documentation
├── scripts/            # Utility scripts
├── .env.example        # Environment variables template
├── pyproject.toml      # Python dependencies
└── README.md
```

---

# 🔮 Future Enhancements

* Mobile application for field workers
* Barcode & QR code medicine scanning
* IoT-enabled inventory monitoring
* SMS alerts for rural areas
* Predictive disease outbreak analytics
* Integration with national healthcare systems
* Voice-based inventory updates

---

# 📈 Impact

PHC Exchange transforms medicine management from a reactive process into a proactive, AI-driven healthcare network.

By enabling Primary Health Centres to collaborate instead of operating independently, the platform helps ensure that essential medicines are available where they are needed most—reducing waste, preventing shortages, and improving patient outcomes.

---

# 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

---

# 📄 License

This project is licensed under the **MIT License**.

---

# ❤️ Built For

Improving public healthcare through intelligent medicine redistribution, predictive analytics, and AI-powered decision making.
