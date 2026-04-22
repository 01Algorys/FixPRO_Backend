# Fix Pro Backend API

A production-ready Node.js backend API for a Fix Pro web application with real-time features, authentication, and comprehensive business logic.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **User Management**: Complete user and worker profile management
- **Service Catalog**: Predefined services with categories and pricing
- **Reservation System**: Full booking workflow with status tracking
- **Review & Rating**: Comprehensive rating system with aspects
- **Real-time Tracking**: Socket.IO for live order tracking
- **Security**: Rate limiting, input sanitization, CORS protection
- **Validation**: Comprehensive request validation with express-validator

## 📋 Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database with Mongoose ODM
- **Socket.IO** - Real-time communication
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **express-validator** - Input validation
- **express-rate-limit** - Rate limiting
- **helmet** - Security headers

## 🛠️ Installation

### Prerequisites
- Node.js 16.0 or higher
- MongoDB 4.4 or higher
- npm or yarn

### Setup

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd backend
npm install
```

2. **Environment Configuration**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
PORT=3001
DB_URI=mongodb://localhost:27017/service_marketplace
JWT_SECRET=your_super_secret_jwt_key_here
CLIENT_URL=http://localhost:3000
```

3. **Start MongoDB**
```bash
# Using MongoDB service
sudo systemctl start mongod

# Or using Docker
docker run -d -p 27017:27017 mongo
```

4. **Run the server**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 📚 API Documentation

### Base URL
```
Development: http://localhost:3001
Production: https://your-api-domain.com
```

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "user",
  "phone": "+1234567890"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Get Profile
```http
GET /api/auth/profile
Authorization: Bearer <jwt_token>
```

### Service Endpoints

#### Get All Services
```http
GET /api/services?page=1&limit=10&category=plumbing
```

#### Get Service by ID
```http
GET /api/services/:id
```

#### Get Services by Category
```http
GET /api/services/category/plumbing
```

### Worker Endpoints

#### Get All Workers
```http
GET /api/workers?category=plumbing&city=New York&minRating=4
```

#### Get Worker Profile
```http
GET /api/workers/:id
```

#### Search Workers
```http
GET /api/workers/search?q=plumber&city=Boston
```

### Reservation Endpoints

#### Create Reservation
```http
POST /api/reservations
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "workerId": "worker_id",
  "service": "service_id",
  "date": "2024-12-25",
  "time": "14:00",
  "duration": 60,
  "location": {
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001"
  },
  "description": "Need to fix leaky faucet"
}
```

#### Update Reservation Status
```http
PUT /api/reservations/:id/status
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "status": "accepted",
  "note": "Will arrive on time"
}
```

### Review Endpoints

#### Create Review
```http
POST /api/reviews
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "reservationId": "reservation_id",
  "rating": 5,
  "comment": "Excellent service!",
  "aspects": {
    "professionalism": 5,
    "quality": 5,
    "timeliness": 4,
    "communication": 5,
    "value": 4
  },
  "wouldHireAgain": true
}
```

#### Get Worker Reviews
```http
GET /api/reviews/worker/:workerId?page=1&limit=10&rating=5
```

## 🔌 Socket.IO Events

### Client to Server Events

#### Join Reservation Room
```javascript
socket.emit('join_reservation', reservationId);
```

#### Update Location
```javascript
socket.emit('update_location', {
  reservationId: 'reservation_id',
  location: { lat: 40.7128, lng: -74.0060 },
  status: 'en_route'
});
```

#### Send Message
```javascript
socket.emit('send_message', {
  reservationId: 'reservation_id',
  message: 'I\'m running 15 minutes late'
});
```

### Server to Client Events

#### Status Update
```javascript
socket.on('status_update', (data) => {
  console.log('Status updated:', data);
  // { reservationId, status, note, timestamp }
});
```

#### Location Update
```javascript
socket.on('worker_location_update', (data) => {
  console.log('Worker location:', data);
  // { reservationId, location, timestamp, status }
});
```

#### New Message
```javascript
socket.on('new_message', (data) => {
  console.log('New message:', data);
  // { reservationId, message, sender, timestamp }
});
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents brute force attacks
- **Input Sanitization**: Prevents NoSQL injection
- **CORS Protection**: Configurable cross-origin policies
- **Security Headers**: Helmet.js for HTTP security
- **Password Hashing**: bcryptjs for secure password storage

## 📊 Database Schema

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (user/worker),
  phone: String,
  location: Object,
  avatar: String,
  isVerified: Boolean
}
```

### Worker Model
```javascript
{
  userId: ObjectId (ref: User),
  bio: String,
  skills: [String],
  services: [ObjectId] (ref: Service),
  experience: Number,
  hourlyRate: Number,
  availability: Object,
  serviceArea: Object,
  stats: {
    jobsCompleted: Number,
    totalEarnings: Number,
    averageRating: Number,
    totalReviews: Number
  }
}
```

### Service Model
```javascript
{
  name: String,
  description: String,
  category: String (plumbing/electrical/hvac/locksmith),
  basePrice: Number,
  duration: Number,
  availability: Object,
  emergency: Object
}
```

### Reservation Model
```javascript
{
  userId: ObjectId (ref: User),
  workerId: ObjectId (ref: User),
  service: ObjectId (ref: Service),
  date: Date,
  time: String,
  duration: Number,
  status: String (pending/accepted/in_progress/completed/cancelled),
  location: Object,
  description: String,
  tracking: [Object]
}
```

### Review Model
```javascript
{
  userId: ObjectId (ref: User),
  workerId: ObjectId (ref: User),
  reservationId: ObjectId (ref: Reservation),
  rating: Number (1-5),
  comment: String,
  aspects: {
    professionalism: Number,
    quality: Number,
    timeliness: Number,
    communication: Number,
    value: Number
  },
  wouldHireAgain: Boolean
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3001 |
| NODE_ENV | Environment | development |
| DB_URI | MongoDB connection string | mongodb://localhost:27017/service_marketplace |
| JWT_SECRET | JWT signing secret | Required |
| JWT_EXPIRE | Token expiration | 30d |
| CLIENT_URL | Frontend URL | http://localhost:3000 |
| ADMIN_IPS | Whitelisted admin IPs | Optional |

## 🚀 Deployment

### Production Setup

1. **Environment Setup**
```bash
export NODE_ENV=production
export DB_URI=mongodb://your-production-db
export JWT_SECRET=your-production-secret
```

2. **Install Dependencies**
```bash
npm ci --only=production
```

3. **Start Server**
```bash
npm start
```

### Docker Deployment

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions, please open an issue in the repository.


Test Accounts:
   Regular User: john.doe@example.com / password123
   Worker: bob.plumber@example.com / password123
   Admin: admin@example.com / password123