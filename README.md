# NetLink

A canvas-centric fiber optic network management tool for designing, managing, and documenting FTTH (Fiber-to-the-Home) infrastructure.

## Features

- **Interactive Topology Canvas**: Visual network design with drag-and-drop nodes
- **Network Hierarchy Management**: OLT → ODF → Closure → LCP → NAP → Customer
- **Splice Documentation**: Track fiber splices with TIA-598 color standards
- **GPS Mapping**: Geographic visualization of network infrastructure
- **Loss Budget Calculations**: Calculate and validate signal loss budgets
- **OTDR Trace Viewer**: Analyze optical time-domain reflectometer traces
- **Inventory Management**: Track fiber optic equipment and materials
- **Local-First Storage**: IndexedDB-based offline-capable data storage

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 16 | React framework with App Router |
| React Flow | Interactive node-based canvas |
| Dexie.js | IndexedDB wrapper for local storage |
| Tailwind CSS | Styling |
| TypeScript | Type safety |
| Lucide React | Icons |
| Konva/react-konva | Canvas rendering for maps |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/Khikoman/netlink.git
cd netlink

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Network Hierarchy

NetLink follows the standard FTTH network hierarchy:

```
OLT (Optical Line Terminal) - Central Office
 └── ODF (Optical Distribution Frame) - Patch Panel
      └── Closure (Splice Closure / Handhole / Pedestal)
           └── LCP (Local Convergence Point) - Distribution with Splitter
                └── NAP (Network Access Point) - Customer Access
                     └── Customer (ONT/ONU) - End User
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/
│   ├── topology/          # Canvas components (React Flow)
│   ├── map/               # GPS mapping components
│   ├── splice/            # Splice management
│   └── ...
├── lib/
│   ├── db/                # Dexie database schema & hooks
│   └── ...
├── contexts/              # React context providers
└── types/                 # TypeScript type definitions
```

## Deployment

### Vercel (Recommended)

The easiest way to deploy NetLink is using [Vercel](https://vercel.com):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Khikoman/netlink)

### Manual Deployment

```bash
npm run build
npm run start
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

---

Built with Next.js and React Flow
