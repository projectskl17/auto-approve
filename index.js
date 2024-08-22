const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const { Group, User } = require('./user');
const { BOT_TOKEN, MONGO_URI } = require('./config');

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

mongoose.connect(MONGO_URI).then(() => console.log('Connected to MongoDB')).catch(err => console.error('Could not connect to MongoDB:', err));

const buttonCache = new Map();

function setCache(key, text, inlineKeyboard) {
    buttonCache.set(key, { text, inlineKeyboard });
}

function getCache(key) {
    return buttonCache.get(key) || { text: '', inlineKeyboard: [] };
}

async function isAdmin(chatId, userId) {
    try {
        const admins = await bot.getChatAdministrators(chatId);
        return admins.some(admin => admin.user.id === userId);
    } catch (error) {
        console.error('Error fetching chat administrators:', error);
        return false;
    }
}


bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!msg.chat.type === 'private' && !await isAdmin(chatId, userId)) {
        return;
    }

    if (msg.chat.type === 'private') {
        const text = `*Welcome to the Auto Approve Bot!*\n\nThis bot helps you manage your group by automatically approving join requests and removing members after a specified time.\n\n🔍 Need help? Press the button below.`;
        const inlineKeyboard = [
            [{ text: '📋 Help', callback_data: 'HELP' }],
            [{ text: '➕ Add me to your group', url: `https://t.me/${bot.username}?startgroup=true&admin=ban_users` }]
        ];
        setCache(chatId, text, inlineKeyboard);

        return bot.sendMessage(chatId, text, {
            reply_markup: { inline_keyboard: inlineKeyboard },
            parse_mode: 'Markdown'
        });
    } else if (msg.chat.type === 'supergroup' || msg.chat.type === 'group') {
        try {
            const group = await Group.findOne({ chatId });

            const text = `*The Auto Approve Bot*\n\nTo manage the bot, use the options below.`;

            const inlineKeyboard = [
                [{ text: group ? 'Deactivate Bot' : 'Activate Bot', callback_data: group ? 'DEACTIVATE' : 'ACTIVATE' }]
            ];
            
            if (group) {
                inlineKeyboard.unshift(
                    [{ text: 'Kick Time', callback_data: 'SET_KICK_TIME' }],
                    [{ text: 'Kick Message', callback_data: 'KICKMESSAGE' }]
                );
            }

            setCache(chatId, text, inlineKeyboard);

            return bot.sendMessage(chatId, text, {
                reply_markup: { inline_keyboard: inlineKeyboard },
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.error('Error checking group activation status:', error);
            return bot.sendMessage(chatId, 'An error occurred while checking the bot status. Please try again later.');
        }
    }
});

bot.on('callback_query', async (query) => {
    const { data, message } = query;
    const chatId = message.chat.id;
    const userId = query.from.id;
    if (!message.chat.type == 'private' && !await isAdmin(chatId, userId)) {
        return;
    }
    if (data === 'HELP') {
        const text = `*Auto Approve Bot Help Menu*\n\nHere’s a brief overview of what this bot can do:\n\n1. **Auto Approve Join Requests**: Automatically approves new join requests to your group.\n2. **Kick Members**: Automatically kicks out members after a specified period.\n3. **Set Kick Time**: Customize how long members stay in the group before being kicked.\n4. **Set Kick Message**: Define a custom message to be sent to the member when kicked.\n\nUse the buttons below to navigate the options.`;

        const inlineKeyboard = [
            [{ text: '🔙 Back', callback_data: 'BACK' }]
        ];

        return bot.editMessageText(text, {
            chat_id: chatId,
            message_id: message.message_id,
            reply_markup: { inline_keyboard: inlineKeyboard },
            parse_mode: 'Markdown'
        });
    }

    if (data === 'ACTIVATE') {
        try {
            const group = await Group.findOne({ chatId });

            if (group) {
                const text = `The bot is already activated in this group. Click the button below to deactivate it.`;
                const inlineKeyboard = [
                    [{ text: 'Deactivate Bot', callback_data: 'DEACTIVATE' }]
                ];
                setCache(chatId, text, inlineKeyboard);
                return await bot.editMessageText(text, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: { inline_keyboard: inlineKeyboard },
                    parse_mode: 'Markdown'
                });
            }

            const newGroup = new Group({ chatId });
            await newGroup.save();

            const text = `The bot has been activated for this group.\n\nClick the button below to deactivate it.`;
            const inlineKeyboard = [
                [{ text: 'Kick Time', callback_data: 'SET_KICK_TIME' }],
                [{ text: 'Kick Message', callback_data: 'KICKMESSAGE' }],
                [{ text: 'Deactivate Bot', callback_data: 'DEACTIVATE' }]
            ];
            setCache(chatId, text, inlineKeyboard);

            return bot.editMessageText(text, {
                chat_id: chatId,
                message_id: message.message_id,
                reply_markup: { inline_keyboard: inlineKeyboard },
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.error('Error activating the bot:', error);
            return bot.sendMessage(chatId, 'Failed to activate the bot.');
        }
    }

    if (data === 'DEACTIVATE') {
        try {
            const group = await Group.findOne({ chatId });

            if (!group) {
                const text = `The bot is not activated in this group. Click the button below to activate it.`;
                const inlineKeyboard = [
                    [{ text: 'Activate Bot', callback_data: 'ACTIVATE' }]
                ];
                setCache(chatId, text, inlineKeyboard);

                return await bot.editMessageText(text, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: { inline_keyboard: inlineKeyboard },
                    parse_mode: 'Markdown'
                });
            }

            await Group.deleteOne({ chatId });

            const text = `The bot has been deactivated for this group.\n\nClick the button below to activate it.`;
            const inlineKeyboard = [
                [{ text: 'Activate Bot', callback_data: 'ACTIVATE' }]
            ];
            setCache(chatId, text, inlineKeyboard);

            return bot.editMessageText(text, {
                chat_id: chatId,
                message_id: message.message_id,
                reply_markup: { inline_keyboard: inlineKeyboard },
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.error('Error deactivating the bot:', error);
            return bot.sendMessage(chatId, 'Failed to deactivate the bot.');
        }
    }

    if (data === 'BACK') {
        const { text, inlineKeyboard } = getCache(chatId);
        if (!text) return;
        return bot.editMessageText(text, {
            chat_id: chatId,
            message_id: message.message_id,
            reply_markup: { inline_keyboard: inlineKeyboard },
            parse_mode: 'Markdown'
        });
    }

    if (data.startsWith('KICK_')) {
        const days = parseInt(data.split('_')[1], 10);
        return await setKickTime(chatId, days);
    }

    if (data === 'KICKCUSTOM_DAYS') {
        return bot.sendMessage(chatId, 'Please enter the number of custom days:', {
            reply_markup: { force_reply: true }
        }).then((sent) => {
            bot.deleteMessage(query.message.chat.id, query.message.message_id);
            bot.onReplyToMessage(sent.chat.id, sent.message_id, async (reply) => {
                const input = reply.text;

                if (!isNaN(input) && parseInt(input) > 0) {
                    await setKickTime(chatId, parseInt(input));
                    await bot.deleteMessage(sent.chat.id, sent.message_id);
                } else {
                    bot.sendMessage(chatId, 'Invalid number of days. Please enter a valid number.');
                }
            });
        });
    }
    if (data === 'SET_KICK_TIME') {
        try {
            const text = `Please choose how many days a user should remain in the group before being kicked.`;
            const inlineKeyboard = [
                [{ text: '1 Day', callback_data: 'KICK_1_DAY' },{ text: '7 Days', callback_data: 'KICK_7_DAYS' }],
                [{ text: '14 Days', callback_data: 'KICK_14_DAYS' },{ text: '30 Days', callback_data: 'KICK_30_DAYS' }],
                [{ text: 'Back', callback_data: 'BACK'},{ text: 'Custom Days', callback_data: 'KICKCUSTOM_DAYS' }]
            ];

            setCache('setKickTime', text, inlineKeyboard);

            return bot.editMessageText(text, {
                chat_id: chatId,
                message_id: message.message_id,
                reply_markup: { inline_keyboard: inlineKeyboard },
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.error('Error in SET_KICK_TIME:', error);
            return bot.sendMessage(chatId, 'Failed to load kick time options.');
        }
    }

    if (data === 'SET_KICKMESSAGE') {
        return bot.sendMessage(chatId, 'Please enter the custom message:', {
            reply_markup: { force_reply: true }
        }).then((sent) => {
            bot.deleteMessage(query.message.chat.id, query.message.message_id);
            bot.onReplyToMessage(sent.chat.id, sent.message_id, async (reply) => {
                const input = reply.text;

                const group = await Group.findOne({ chatId });
                if (group) {
                    group.customMessage = input;
                    group.customMessageEnabled = true;
                    await group.save();
                } else {
                    await new Group({ chatId, customMessage: input, customMessageEnabled: true }).save();
                }

                await bot.sendMessage(chatId, 'Custom message has been set.');
                await bot.deleteMessage(sent.chat.id, sent.message_id);
            });
        });
    }
    if (data === 'TOGGLE_KICKMESSAGE') {
        try {
            const group = await Group.findOne({ chatId });
            
            if (group) {
                group.customMessageEnabled = !group.customMessageEnabled;
                await group.save();
            }

            const text = `Custom message is currently ${group.customMessageEnabled ? 'enabled' : 'disabled'}.`;
            const inlineKeyboard = [
                [{ text: group.customMessageEnabled ? 'Disable Message' : 'Enable Message', callback_data: 'TOGGLE_KICKMESSAGE' }],
                [{ text: 'Back', callback_data: 'BACK' }]
            ];

            return bot.editMessageText(text, {
                chat_id: chatId,
                message_id: message.message_id,
                reply_markup: { inline_keyboard: inlineKeyboard },
                parse_mode: 'Markdown'
            });

        } catch (error) {
            console.error('Error toggling kick message:', error);
            return bot.sendMessage(chatId, 'Failed to toggle kick message.');
        }
    }
    if (data === 'KICKMESSAGE') {
        try {
            const group = await Group.findOne({ chatId });

            if (!group) {
                return bot.sendMessage(chatId, 'The bot is not activated in this group.');
            }

            const text = `Custom message is currently ${group.customMessageEnabled ? 'enabled' : 'disabled'}.`;
            const inlineKeyboard = [
                [{ text: group.customMessageEnabled ? 'Disable Message' : 'Enable Message', callback_data: 'TOGGLE_KICKMESSAGE' }],
                [{ text: 'Set Custom Message', callback_data: 'SET_KICKMESSAGE' }],
                [{ text: 'Back', callback_data: 'BACK' }]
            ];

            return bot.editMessageText(text, {
                chat_id: chatId,
                message_id: message.message_id,
                reply_markup: { inline_keyboard: inlineKeyboard },
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.error('Error in KICKMESSAGE:', error);
            return bot.sendMessage(chatId, 'Failed to load kick message options.');
        }
    }
});

bot.on('chat_join_request', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const group = await Group.findOne({ chatId });

    if (group) {
        await bot.approveChatJoinRequest(chatId, userId);

        const kickAfter = group.kickAfter || 7 * 24 * 60 * 60 * 1000; // Default to 7 days if not set
        const kickDate = new Date(Date.now() + kickAfter);

        const user = new User({
            userId: userId,
            chatId: chatId,
            kickDate: kickDate
        });
        await user.save();

    } else {
        console.log(`Chat ${chatId} is not in the database. User ${userId} will not be added to the kick list.`);
    }
});


bot.on('new_chat_members', async (msg) => {
    const chatId = msg.chat.id;
    const members = msg.new_chat_members;

    const group = await Group.findOne({ chatId });

    if (group) {
        const kickAfter = group.kickAfter || 1 * 24 * 60 * 60 * 1000;
        for (const member of members) {
            if (member.is_bot) continue;

            const kickDate = new Date(Date.now() + kickAfter);

            const user = new User({
                userId: member.id,
                chatId: chatId,
                kickDate: kickDate
            });
            await user.save();

        }
    } else {
        console.log(`Chat ${chatId} is not in the database. Members will not be added to the kick list.`);
    }
});


bot.on('left_chat_member', async (msg) => {
    try {
        const userId = msg.left_chat_member.id;
        const chatId = msg.chat.id;

        const group = await Group.findOne({ chatId });

        if (group) {

        await User.deleteMany({ userId: userId, chatId: chatId });

        }
    } catch (error) {
        console.error('Error in left_chat_member:', error);
    }
});

async function setKickTime(chatId, days) {
    try {
        const kickAfterMillis = days * 24 * 60 * 60 * 1000;

        const group = await Group.findOne({ chatId });

        if (group) {
            group.kickAfter = kickAfterMillis;
            await group.save();
        } else {
            await new Group({ chatId, kickAfter: kickAfterMillis }).save();
        }

        await bot.sendMessage(chatId, `Kick time has been set to ${days} day(s).`);
    } catch (error) {
        console.error('Error setting kick time:', error);
        return bot.sendMessage(chatId, 'Failed to set kick time.');
    }
}

setInterval(async () => {
    try {
        const now = new Date();
        const usersToKick = await User.find({ kickDate: { $lte: now } });

        for (const user of usersToKick) {
            try {
                const admins = await bot.getChatAdministrators(user.chatId);
                const isAdmin = admins.some(admin => admin.user.id === user.userId);

                if (isAdmin) {
                    continue; 
                }

                const group = await Group.findOne({ chatId: user.chatId });

                if (group && group.customMessageEnabled && group.customMessage) {
                    try {
                        await bot.sendMessage(user.userId, group.customMessage);
                    } catch (err) {
                        console.error(`Failed to send custom message to user ${user.userId}:`, err);
                    }
                }

                try {
                    await bot.banChatMember(user.chatId, user.userId);
                    // await bot.unbanChatMember(user.chatId, user.userId);
                    await User.deleteOne({ _id: user._id });
                } catch (err) {
                    console.error(`Failed to kick user ${user.userId}:`, err);
                }
            } catch (err) {
                console.error(`Failed to process user ${user.userId}:`, err);
            }
        }
    } catch (error) {
        console.error('Error in kicking users:', error);
    }
}, 300000);


bot.on('polling_error', (err) => console.log(err));
