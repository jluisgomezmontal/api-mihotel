# MiHotel SaaS - Multi-Tenant Hotel Management Backend

A robust, scalable multi-tenant SaaS backend for managing hotels, Airbnb properties, and posadas. Built with Node.js, Express.js, MongoDB, and Mongoose with complete tenant isolation.

## 🏗️ Architecture

### Multi-Tenant Design
- **Single Database + tenantId**: All collections include a `tenantId` field for data isolation
- **Automatic Tenant Filtering**: Middleware automatically injects tenant filters on all queries
- **Complete Data Isolation**: No cross-tenant data access possible
- **Scalable Design**: Can handle thousands of tenants efficiently

### Tech Stack
- **Runtime**: Node.js with ES Modules
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcryptjs
- **Validation**: Zod schemas
- **Security**: Helmet, CORS, Rate limiting

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.x
- MongoDB (local or cloud)
- npm or yarn

### Installation

1. **Clone and setup**
```bash
cd api
npm install
```

2. **Environment setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start the server**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Environment Configuration

Create a `.env` file with the following variables:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/mihotel_saas

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRE=7d

# Server
PORT=3000
NODE_ENV=development

# Security
BCRYPT_SALT_ROUNDS=12
```

## 📊 Data Models

### Core Entities

1. **Tenant** - Business entity (hotel/airbnb/posada)
2. **User** - Multi-role users within tenants
3. **Property** - Individual properties owned by tenant
4. **Room** - Individual rooms/units within properties
5. **Guest** - Customer information
6. **Reservation** - Booking records
7. **Payment** - Transaction records

### Multi-Tenant Fields

Every model (except Tenant) includes:
- `tenantId`: Links to tenant
- `createdAt/updatedAt`: Timestamps
- `isActive`: Soft delete flag

## 🔐 Authentication & Authorization

### User Roles
- **Admin**: Full access to tenant data
- **Staff**: Manage reservations and guests
- **Cleaning**: View cleaning schedules only

### Permission System
```javascript
// User permissions object
{
  canManageProperties: boolean,
  canManageUsers: boolean,
  canManageReservations: boolean,
  canViewReports: boolean
}
```

### JWT Authentication
- Stateless JWT tokens
- Automatic tenant injection
- Role-based route protection

## 🛣️ API Endpoints

### Authentication
```
POST /api/auth/register     # Register tenant + admin
POST /api/auth/login        # User login
GET  /api/auth/profile      # Get user profile
PUT  /api/auth/profile      # Update profile
PUT  /api/auth/change-password # Change password
```

### Properties
```
GET    /api/properties                    # List properties
POST   /api/properties                    # Create property
GET    /api/properties/:id                # Get property
PUT    /api/properties/:id                # Update property
DELETE /api/properties/:id                # Delete property
GET    /api/properties/:id/dashboard      # Property stats
```

### Reservations
```
GET  /api/reservations                    # List reservations
POST /api/reservations                    # Create reservation
GET  /api/reservations/:id                # Get reservation
PUT  /api/reservations/:id/checkin        # Check-in guest
PUT  /api/reservations/:id/checkout       # Check-out guest
PUT  /api/reservations/:id/cancel         # Cancel reservation
POST /api/reservations/check-availability # Check room availability
GET  /api/reservations/current            # Current guests
```

## 🏗️ Project Structure

```
src/
├── config/
│   ├── constants.js         # Application constants
│   └── database.js         # MongoDB configuration
├── middlewares/
│   ├── auth.js             # JWT authentication
│   ├── tenantGuard.js      # Multi-tenant isolation
│   ├── validation.js       # Zod validation
│   ├── errorHandler.js     # Global error handling
│   └── security.js         # Security middleware
├── modules/
│   ├── auth/               # Authentication module
│   ├── tenants/           # Tenant management
│   ├── properties/        # Property management
│   ├── rooms/             # Room management
│   ├── guests/            # Guest management
│   ├── reservations/      # Booking management
│   └── payments/          # Payment processing
├── schemas/               # Zod validation schemas
├── utils/                 # Utility functions
├── app.js                # Express app configuration
└── server.js             # Server entry point
```

## 🔒 Security Features

### Multi-Tenant Security
- Automatic tenant ID injection on all queries
- Prevention of cross-tenant data access
- Tenant ownership validation on resources

### General Security
- Rate limiting (100 req/15min, 5 auth req/15min)
- Input sanitization
- SQL injection prevention
- XSS protection with Helmet
- CORS configuration
- Request timeout handling

## 📝 Usage Examples

### Register New Tenant
```javascript
POST /api/auth/register
{
  "tenant": {
    "name": "Hotel Paradise",
    "type": "hotel",
    "plan": "basic"
  },
  "admin": {
    "name": "John Doe",
    "email": "john@hotelparadise.com",
    "password": "securePassword123"
  }
}
```

### Create Property
```javascript
POST /api/properties
Authorization: Bearer <jwt_token>
{
  "name": "Main Hotel Building",
  "address": {
    "street": "123 Beach Ave",
    "city": "Cancun",
    "state": "Quintana Roo",
    "country": "Mexico"
  },
  "checkInTime": "15:00",
  "checkOutTime": "11:00",
  "timezone": "America/Cancun"
}
```

### Create Reservation
```javascript
POST /api/reservations
Authorization: Bearer <jwt_token>
{
  "propertyId": "60d5ecb74b24a12f88c4c4a1",
  "roomId": "60d5ecb74b24a12f88c4c4a2",
  "guestId": "60d5ecb74b24a12f88c4c4a3",
  "dates": {
    "checkInDate": "2024-02-15",
    "checkOutDate": "2024-02-18"
  },
  "guests": {
    "adults": 2,
    "children": 1
  }
}
```

## 🧪 Development

### Running in Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Code Standards
- ES Modules syntax
- JSDoc comments for functions
- Consistent error handling
- Input validation with Zod
- Multi-tenant data isolation

### Database Indexes

Key indexes for performance:
```javascript
// Users: compound index for tenant isolation
{ tenantId: 1, email: 1 } // unique

// Reservations: for date range queries
{ tenantId: 1, propertyId: 1, "dates.checkInDate": 1 }
{ tenantId: 1, roomId: 1, "dates.checkInDate": 1, "dates.checkOutDate": 1 }

// Rooms: for availability checks
{ tenantId: 1, propertyId: 1, status: 1 }
```

## 🚦 API Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `422` - Unprocessable Entity
- `500` - Internal Server Error

## 🐛 Error Handling

### Consistent Error Response Format
```javascript
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed validation errors..."] // Optional
}
```

### Success Response Format
```javascript
{
  "success": true,
  "message": "Operation successful", // Optional
  "data": {
    // Response data
  }
}
```

## 📈 Monitoring & Health

### Health Check
```
GET /health
```
Returns server status, uptime, and database connectivity.

### API Info
```
GET /api
```
Returns API version, endpoints, and documentation links.

## 🔄 Future Enhancements

### Planned Features
- [ ] WebSocket support for real-time updates
- [ ] Advanced reporting and analytics
- [ ] Integration with external booking platforms
- [ ] Email notification system
- [ ] File upload for images
- [ ] Advanced user management
- [ ] Multi-language support
- [ ] API documentation with Swagger

### Scaling Considerations
- Redis for caching and sessions
- Microservices architecture
- Database sharding strategies
- CDN for static assets
- Load balancing configuration

## 📚 API Documentation

Once running, visit:
- API Info: `http://localhost:3000/api`
- Health Check: `http://localhost:3000/health`

## 🤝 Contributing

1. Follow existing code patterns
2. Add validation schemas for new endpoints
3. Ensure proper tenant isolation
4. Include error handling
5. Add JSDoc comments
6. Test multi-tenant scenarios

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For technical support or feature requests, please contact the development team.

---

**MiHotel SaaS Backend** - Built with ❤️ for the hospitality industry
# api-mihotel
