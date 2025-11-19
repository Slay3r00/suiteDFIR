# VDF Tools (Dev)

A web-based forensic analysis tool that provides a modern interface for **iLEAPP** (iOS Logs, Events, and Plist Parser). Built with Next.js frontend and FastAPI backend to process iOS forensic data through a web interface. This will be expanded on to become a comprehensive VDF Toolkit with many more features beyond just a GUI wrapper for iLEAPP.

## Features

- **Web Interface**: Modern, responsive UI for iLEAPP forensic analysis
- **Real-time Processing**: Live streaming of forensic analysis logs
- **Module Selection**: Choose specific forensic analysis modules
- **File Management**: Native macOS file/folder browsing integration
- **Multi-format Support**: Handles various iOS forensic formats (tar, zip, filesystem)

## Architecture

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Backend**: FastAPI with Python for iLEAPP integration
- **iLEAPP**: Integrated forensic analysis engine for iOS data

## Installation

### Prerequisites

- macOS (required for native file dialogs)
- Python 3.10-3.12
- Node.js 20.9.0+
- npm or yarn

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

## Usage

### 1. Start Backend Server

```bash
cd backend
source venv/bin/activate  # If not already activated
python main.py
```

The API will be available at `http://localhost:8000`

### 2. Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The web interface will be available at `http://localhost:3000`

### 3. Using the Interface

1. Open `http://localhost:3000` in your browser
2. Browse and select your iLEAPP compatible iOS forensic file
3. Choose an output folder for results
4. Select forensic analysis modules
5. Click "Start Processing" to begin analysis
6. Check real-time processing logs in the right panel

## Supported File Types

- .tar
- .zip

## License

This is a proprietary project