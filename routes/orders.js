const express = require('express');
const router = express.Router();
const { pool: db } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// POST /api/orders - Public route to submit an order
router.post('/', async (req, res) => {
  const { table_number, total_amount, items } = req.body;

  if (!table_number || total_amount === undefined || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required order fields or items' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Insert order
    const orderResult = await client.query(
      `INSERT INTO orders (table_number, total_amount, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [table_number, total_amount]
    );
    const order = orderResult.rows[0];

    // Insert order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          order.id,
          // Extract product ID if it's an integer, else null
          Number.isInteger(Number(item.id)) && !String(item.id).startsWith('pick-') ? item.id : null,
          item.name,
          item.price,
          item.quantity
        ]
      );
    }

    await client.query('COMMIT');
    logger.info('Order created', { orderId: order.id, table: table_number });
    res.status(201).json({ data: order });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating order:', { err: error.message });
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

// GET /api/orders/admin - Admin route to get all orders with items
router.get('/admin/all', verifyToken, async (req, res) => {
  try {
    const ordersResult = await db.query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );
    const orders = ordersResult.rows;

    const itemsResult = await db.query(
      'SELECT * FROM order_items'
    );
    const allItems = itemsResult.rows;

    // Group items by order_id
    const ordersWithItems = orders.map(order => ({
      ...order,
      items: allItems.filter(item => item.order_id === order.id)
    }));

    res.json({ data: ordersWithItems });
  } catch (error) {
    logger.error('Error fetching admin orders:', { err: error.message });
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// PUT /api/orders/admin/:id/status - Admin route to update status
router.put('/admin/:id/status', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // pending, preparing, completed, cancelled

  if (!['pending', 'preparing', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const result = await db.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    logger.info('Order status updated', { orderId: id, status });
    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating order status:', { err: error.message });
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// DELETE /api/orders/admin/:id - Admin route to delete order
router.delete('/admin/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM orders WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    logger.info('Order deleted', { orderId: id });
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    logger.error('Error deleting order:', { err: error.message });
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

module.exports = router;
