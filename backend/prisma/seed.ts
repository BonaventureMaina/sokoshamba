import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Helper function to hash passwords
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Kenyan counties
const COUNTIES = [
  'Nairobi', 'Kiambu', 'Nakuru', 'Nyeri', 'Murang\'a',
  'Machakos', 'Kajiado', 'Meru', 'Embu', 'Kirinyaga',
];

// Kenyan first names
const FIRST_NAMES = [
  'John', 'Jane', 'Peter', 'Mary', 'David', 'Grace', 'James', 'Sarah',
  'Joseph', 'Lucy', 'Daniel', 'Faith', 'Samuel', 'Ruth', 'Michael', 'Ann',
  'Patrick', 'Catherine', 'Francis', 'Rose', 'Paul', 'Elizabeth', 'George', 'Margaret',
  'Simon', 'Joyce', 'Stephen', 'Alice', 'Anthony', 'Rebecca', 'Moses', 'Rachel',
  'William', 'Esther', 'Henry', 'Mercy', 'Charles', 'Agnes', 'Benjamin', 'Judith',
  'Timothy', 'Martha', 'Philip', 'Beatrice', 'Andrew', 'Christine', 'Nicholas', 'Susan',
  'Emmanuel', 'Hannah', 'Mark', 'Lydia', 'Matthew', 'Priscilla', 'Richard', 'Veronica',
  'Thomas', 'Caroline', 'Vincent', 'Dorothy', 'Martin', 'Edith',
];

// Kenyan surnames
const LAST_NAMES = [
  'Kamau', 'Wanjiku', 'Ochieng', 'Achieng', 'Mwangi', 'Njeri', 'Otieno', 'Adhiambo',
  'Kariuki', 'Wambui', 'Kipchoge', 'Chebet', 'Muthoni', 'Njoroge', 'Mutua', 'Mwende',
  'Kibet', 'Chepkemoi', 'Kinyanjui', 'Wairimu', 'Ouma', 'Atieno', 'Karanja', 'Nyambura',
  'Koech', 'Jepkorir', 'Kimani', 'Wangari', 'Onyango', 'Apiyo', 'Githinji', 'Wangui',
  'Kiplagat', 'Chepkoech', 'Mburu', 'Waweru', 'Owino', 'Akinyi', 'Ruto', 'Jebiwott',
];

// Kenyan produce data
const PRODUCTS_DATA = [
  // Vegetables
  { name: 'Sukuma Wiki (Kale)', unit: 'bunch', price: 50, category: 'Vegetables' },
  { name: 'Managu (African Nightshade)', unit: 'bunch', price: 60, category: 'Vegetables' },
  { name: 'Terere (Amaranth)', unit: 'bunch', price: 55, category: 'Vegetables' },
  { name: 'Kunde (Cowpeas Leaves)', unit: 'bunch', price: 50, category: 'Vegetables' },
  { name: 'Spinach', unit: 'bunch', price: 60, category: 'Vegetables' },
  { name: 'Cabbage', unit: 'piece', price: 80, category: 'Vegetables' },
  { name: 'Organic Tomatoes', unit: 'kg', price: 120, category: 'Vegetables' },
  { name: 'Onions', unit: 'kg', price: 100, category: 'Vegetables' },
  { name: 'Carrots', unit: 'kg', price: 80, category: 'Vegetables' },
  { name: 'Green Beans', unit: 'kg', price: 150, category: 'Vegetables' },
  
  // Roots & Tubers
  { name: 'Arrow Roots', unit: 'kg', price: 100, category: 'Roots & Tubers' },
  { name: 'Sweet Potatoes', unit: 'kg', price: 80, category: 'Roots & Tubers' },
  { name: 'Irish Potatoes', unit: 'kg', price: 70, category: 'Roots & Tubers' },
  { name: 'Cassava', unit: 'kg', price: 60, category: 'Roots & Tubers' },
  { name: 'Yams', unit: 'kg', price: 120, category: 'Roots & Tubers' },
  
  // Fruits
  { name: 'Avocados', unit: 'piece', price: 50, category: 'Fruits' },
  { name: 'Mangoes', unit: 'piece', price: 40, category: 'Fruits' },
  { name: 'Bananas', unit: 'bunch', price: 150, category: 'Fruits' },
  { name: 'Passion Fruits', unit: 'kg', price: 200, category: 'Fruits' },
  { name: 'Watermelons', unit: 'piece', price: 300, category: 'Fruits' },
  
  // Legumes
  { name: 'Njahi (Black Beans)', unit: 'kg', price: 180, category: 'Legumes' },
  { name: 'Green Grams', unit: 'kg', price: 200, category: 'Legumes' },
  { name: 'Ndengu (Mung Beans)', unit: 'kg', price: 180, category: 'Legumes' },
  { name: 'Peas', unit: 'kg', price: 160, category: 'Legumes' },
  
  // Herbs
  { name: 'Coriander (Dhania)', unit: 'bunch', price: 20, category: 'Herbs' },
  { name: 'Spring Onions', unit: 'bunch', price: 30, category: 'Herbs' },
  { name: 'Mint', unit: 'bunch', price: 30, category: 'Herbs' },
];

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clear existing data (in reverse order of dependencies)
  console.log('🗑️  Clearing existing data...');
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.address.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.farmerProfile.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Existing data cleared\n');

  // Create Categories
  console.log('📂 Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Vegetables',
        slug: 'vegetables',
        description: 'Fresh leafy greens and vegetables',
        displayOrder: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Fruits',
        slug: 'fruits',
        description: 'Fresh seasonal fruits',
        displayOrder: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Roots & Tubers',
        slug: 'roots-tubers',
        description: 'Roots, tubers, and underground vegetables',
        displayOrder: 3,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Legumes',
        slug: 'legumes',
        description: 'Beans, peas, and pulses',
        displayOrder: 4,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Herbs',
        slug: 'herbs',
        description: 'Fresh herbs and spices',
        displayOrder: 5,
      },
    }),
  ]);
  console.log(`✅ Created ${categories.length} categories\n`);

  // Create Admin Users
  console.log('👨‍💼 Creating admin users...');
  const adminPassword = await hashPassword('Admin@2024');
  const admins = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@sokoshamba.co.ke',
        phone: '254700000001',
        passwordHash: adminPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'support@sokoshamba.co.ke',
        phone: '254700000002',
        passwordHash: adminPassword,
        firstName: 'Support',
        lastName: 'Team',
        role: 'admin',
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'operations@sokoshamba.co.ke',
        phone: '254700000003',
        passwordHash: adminPassword,
        firstName: 'Operations',
        lastName: 'Manager',
        role: 'admin',
        isVerified: true,
      },
    }),
  ]);
  console.log(`✅ Created ${admins.length} admin users\n`);

  // Create Farmer Users with Profiles
  console.log('👨‍🌾 Creating farmers and profiles...');
  const farmerPassword = await hashPassword('Farmer@2024');
  const farmers = [];

  for (let i = 0; i < 20; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const county = COUNTIES[i % COUNTIES.length];

    const farmer = await prisma.user.create({
      data: {
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@farmer.co.ke`,
        phone: `2547${String(10000000 + i).padStart(8, '0')}`,
        passwordHash: farmerPassword,
        firstName,
        lastName,
        role: 'farmer',
        isVerified: i < 15, // First 15 farmers are verified
        farmerProfile: {
          create: {
            farmName: `${firstName} ${lastName} Farm`,
            bio: `Organic farmer specializing in fresh produce from ${county} County`,
            locationCounty: county,
            locationSubcounty: `${county} Central`,
            locationDetails: `Near ${county} town center`,
            certifications: i < 10 ? ['organic'] : [],
            isVerified: i < 15,
            verificationDate: i < 15 ? new Date() : null,
            ratingAvg: 4.0 + Math.random() * 0.9, // 4.0 - 4.9
            totalOrders: Math.floor(Math.random() * 50),
          },
        },
      },
    });
    farmers.push(farmer);
  }
  console.log(`✅ Created ${farmers.length} farmers with profiles\n`);

  // Create Consumer Users
  console.log('👥 Creating consumer users...');
  const consumerPassword = await hashPassword('Consumer@2024');
  const consumers = [];

  for (let i = 0; i < 50; i++) {
    const firstName = FIRST_NAMES[(i + 20) % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i + 20) % LAST_NAMES.length];

    const consumer = await prisma.user.create({
      data: {
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@gmail.com`,
        phone: `2547${String(20000000 + i).padStart(8, '0')}`,
        passwordHash: consumerPassword,
        firstName,
        lastName,
        role: 'consumer',
        isVerified: true,
      },
    });
    consumers.push(consumer);
  }
  console.log(`✅ Created ${consumers.length} consumers\n`);

  // Create Products
  console.log('🥬 Creating products...');
  const products = [];

  for (let i = 0; i < 100; i++) {
    const productTemplate = PRODUCTS_DATA[i % PRODUCTS_DATA.length];
    const farmer = farmers[i % farmers.length];
    const category = categories.find((c) => c.name === productTemplate.category);

    if (!category) continue;

    const product = await prisma.product.create({
      data: {
        farmerId: farmer.id,
        categoryId: category.id,
        name: productTemplate.name,
        description: `Fresh ${productTemplate.name.toLowerCase()} from ${farmer.firstName}'s farm`,
        unit: productTemplate.unit,
        unitQuantity: 1,
        priceKsh: productTemplate.price * (0.8 + Math.random() * 0.4), // ±20% variation
        stockQuantity: Math.floor(Math.random() * 100) + 20,
        isOrganic: Math.random() > 0.5,
        isAvailable: Math.random() > 0.1, // 90% available
        images: [],
        tags: ['fresh', 'local'],
        ratingAvg: 3.5 + Math.random() * 1.5, // 3.5 - 5.0
        totalReviews: Math.floor(Math.random() * 20),
        totalSold: Math.floor(Math.random() * 100),
      },
    });
    products.push(product);
  }
  console.log(`✅ Created ${products.length} products\n`);

  // Create Addresses
  console.log('📍 Creating addresses...');
  const addresses = [];

  for (let i = 0; i < 50; i++) {
    const consumer = consumers[i % consumers.length];
    const county = COUNTIES[i % COUNTIES.length];

    const address = await prisma.address.create({
      data: {
        userId: consumer.id,
        label: i % 2 === 0 ? 'Home' : 'Office',
        fullName: `${consumer.firstName} ${consumer.lastName}`,
        phone: consumer.phone,
        county,
        subcounty: `${county} Central`,
        streetAddress: `${Math.floor(Math.random() * 500) + 1} ${['Kenyatta', 'Moi', 'Uhuru', 'Kimathi'][i % 4]} Avenue`,
        buildingDetails: `Apartment ${Math.floor(Math.random() * 100) + 1}`,
        deliveryInstructions: 'Please call on arrival',
        isDefault: i % 2 === 0,
      },
    });
    addresses.push(address);
  }
  console.log(`✅ Created ${addresses.length} addresses\n`);

  // Create Orders
  console.log('🛒 Creating orders...');
  const orders = [];

  for (let i = 0; i < 50; i++) {
    const consumer = consumers[i % consumers.length];
    const address = addresses.find((a) => a.userId === consumer.id) || addresses[0];
    const orderDate = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)); // Last 30 days

    const order = await prisma.order.create({
      data: {
        orderNumber: `SKS-2024-${String(i + 1).padStart(6, '0')}`,
        customerId: consumer.id,
        deliveryAddressId: address.id,
        status: ['delivered', 'in_transit', 'preparing', 'paid'][Math.floor(Math.random() * 4)],
        subtotalKsh: 0, // Will update after order items
        deliveryFeeKsh: 100,
        totalKsh: 0, // Will update after order items
        paymentMethod: 'mpesa',
        paymentStatus: 'completed',
        paymentRef: `QGX${String(1000000 + i).substring(1)}`,
        deliveryScheduledAt: new Date(orderDate.getTime() + 24 * 60 * 60 * 1000),
        deliveredAt: Math.random() > 0.5 ? new Date(orderDate.getTime() + 48 * 60 * 60 * 1000) : null,
        createdAt: orderDate,
      },
    });
    orders.push(order);
  }
  console.log(`✅ Created ${orders.length} orders\n`);

  // Create Order Items and update order totals
  console.log('📦 Creating order items...');
  const orderItems = [];

  for (const order of orders) {
    const numItems = Math.floor(Math.random() * 4) + 1; // 1-4 items per order
    let orderSubtotal = 0;

    for (let i = 0; i < numItems; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const pricePerUnit = product.priceKsh;
      const subtotal = Number(pricePerUnit) * quantity;
      orderSubtotal += subtotal;

      const orderItem = await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          farmerId: product.farmerId,
          productName: product.name,
          unit: product.unit,
          unitQuantity: product.unitQuantity,
          pricePerUnitKsh: pricePerUnit,
          quantity,
          subtotalKsh: subtotal,
          status: order.status === 'delivered' ? 'delivered' : 'pending',
        },
      });
      orderItems.push(orderItem);
    }

    // Update order total
    await prisma.order.update({
      where: { id: order.id },
      data: {
        subtotalKsh: orderSubtotal,
        totalKsh: orderSubtotal + 100, // Add delivery fee
      },
    });
  }
  console.log(`✅ Created ${orderItems.length} order items\n`);

  // Create Transactions
  console.log('💰 Creating transactions...');
  const transactions = [];

  for (const order of orders) {
    const transaction = await prisma.transaction.create({
      data: {
        orderId: order.id,
        type: 'payment',
        amountKsh: order.totalKsh,
        currency: 'KES',
        paymentMethod: 'mpesa',
        paymentProvider: 'mpesa',
        providerTransactionId: order.paymentRef,
        providerReference: `REF${order.orderNumber}`,
        status: 'completed',
        metadata: {},
      },
    });
    transactions.push(transaction);
  }
  console.log(`✅ Created ${transactions.length} transactions\n`);

  // Create Reviews
  console.log('⭐ Creating reviews...');
  const reviews = [];

  // Only review delivered orders
  const deliveredOrderItems = orderItems.filter((item) => item.status === 'delivered');
  const reviewableItems = deliveredOrderItems.slice(0, 80); // Create 80 reviews

  for (const orderItem of reviewableItems) {
    const order = orders.find((o) => o.id === orderItem.orderId);
    if (!order) continue;

    const rating = Math.floor(Math.random() * 2) + 4; // 4 or 5 stars (mostly positive)
    const comments = [
      'Fresh and high quality produce!',
      'Excellent service, will order again.',
      'Very satisfied with the freshness.',
      'Great quality from the farmer.',
      'Delivered on time and fresh.',
    ];

    const review = await prisma.review.create({
      data: {
        orderItemId: orderItem.id,
        customerId: order.customerId,
        farmerId: orderItem.farmerId,
        productId: orderItem.productId,
        rating,
        comment: comments[Math.floor(Math.random() * comments.length)],
        images: [],
        isVerifiedPurchase: true,
      },
    });
    reviews.push(review);
  }
  console.log(`✅ Created ${reviews.length} reviews\n`);

  // Create sample Notifications
  console.log('🔔 Creating notifications...');
  const notifications = [];

  for (let i = 0; i < 30; i++) {
    const user = i < 15 ? farmers[i % farmers.length] : consumers[i % consumers.length];

    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        type: ['order_update', 'payment_received', 'new_review'][i % 3],
        title: 'Order Update',
        message: 'Your order has been delivered successfully',
        data: {},
        isRead: Math.random() > 0.5,
      },
    });
    notifications.push(notification);
  }
  console.log(`✅ Created ${notifications.length} notifications\n`);

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Database seeded successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 Summary:');
  console.log(`   • ${admins.length} Admin users`);
  console.log(`   • ${farmers.length} Farmers (with profiles)`);
  console.log(`   • ${consumers.length} Consumers`);
  console.log(`   • ${categories.length} Categories`);
  console.log(`   • ${products.length} Products`);
  console.log(`   • ${addresses.length} Addresses`);
  console.log(`   • ${orders.length} Orders`);
  console.log(`   • ${orderItems.length} Order items`);
  console.log(`   • ${transactions.length} Transactions`);
  console.log(`   • ${reviews.length} Reviews`);
  console.log(`   • ${notifications.length} Notifications`);
  console.log('\n🔐 Test Credentials:');
  console.log('   Admin:    admin@sokoshamba.co.ke / Admin@2024');
  console.log('   Farmer:   [any farmer email] / Farmer@2024');
  console.log('   Consumer: [any consumer email] / Consumer@2024');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });