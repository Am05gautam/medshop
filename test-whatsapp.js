const axios = require('axios');
require('dotenv').config();

async function testWhatsAppConnection() {
    console.log('🧪 Testing WhatsApp API Connection...\n');
    
    const apiUrl = process.env.WHATSAPP_API_URL;
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const testPhone = process.env.ADMIN_PHONE_NUMBERS;
    
    console.log('Configuration:');
    console.log(`API URL: ${apiUrl}`);
    console.log(`Phone Number ID: ${phoneNumberId}`);
    console.log(`Test Phone: ${testPhone}`);
    console.log(`Token: ${token ? token.substring(0, 20) + '...' : 'NOT SET'}\n`);
    
    if (!token || !phoneNumberId || !testPhone) {
        console.error('❌ Missing required configuration!');
        console.log('Please check your .env file and ensure all WhatsApp credentials are set.');
        return;
    }
    
    try {
        // Test 1: Verify phone number ID
        console.log('Test 1: Verifying Phone Number ID...');
        const phoneResponse = await axios.get(`${apiUrl}/${phoneNumberId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('✅ Phone Number ID verified:', phoneResponse.data.display_phone_number);
        
        // Test 2: Send test message
        console.log('\nTest 2: Sending test message...');
        const messageResponse = await axios.post(`${apiUrl}/${phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            to: testPhone,
            type: 'text',
            text: {
                body: `🧪 *TEST MESSAGE*\n\nHello! This is a test message from Gautam Medicals Inventory Management System.\n\nTime: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\nIf you receive this message, WhatsApp integration is working correctly! ✅`
            }
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Test message sent successfully!');
        console.log('Message ID:', messageResponse.data.messages[0].id);
        console.log(`\n📱 Check your WhatsApp (${testPhone}) for the test message!`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.response?.data?.error) {
            const errorData = error.response.data.error;
            console.log('\n🔍 Error Details:');
            console.log(`Code: ${errorData.code}`);
            console.log(`Message: ${errorData.message}`);
            
            if (errorData.error_subcode) {
                console.log(`Subcode: ${errorData.error_subcode}`);
            }
            
            // Common error solutions
            console.log('\n💡 Common Solutions:');
            if (errorData.code === 190) {
                console.log('- Invalid access token. Generate a new permanent token.');
            } else if (errorData.code === 100) {
                console.log('- Invalid phone number ID. Check your WhatsApp Business setup.');
            } else if (errorData.code === 131026) {
                console.log('- Phone number not found. Ensure the recipient has WhatsApp.');
            } else if (errorData.code === 131021) {
                console.log('- Recipient cannot receive messages. Check phone number format.');
            }
        }
    }
}

// Run the test
testWhatsAppConnection().catch(console.error);
