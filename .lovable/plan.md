

## Update Telegram Welcome Message

### Change
Replace the current English greeting with a bilingual Khmer/English service menu in the Telegram bot.

---

### File to Modify
`supabase/functions/telegram-bot/index.ts` (lines 187-195)

---

### Current Message
```
👋 Hi ${firstName}!

Thanks for reaching out to ExplorerBySL! ✨

One of our team members will be connected with you shortly to help with your inquiry.

Feel free to send us a message anytime – we're here to help you plan your perfect adventure! 🌍

Is there anything specific you'd like to know about our travel services?
```

---

### New Message
```
ក្រុមហ៊ុនទេសចរណ៍ អុិចផ្លរឺ

Explorer by SL

កញ្ចប់ធួរ | Tour Packages
សំបុត្រយន្តហោះ | Fight Booking
កក់សណ្ឋាគារ | Hotel Reservation
ធ្វើវីសាគ្រប់ប្រទេស | Visa Abroad
លិខិតឆ្លងដែន | Passport
ជួលខុនដូគ្រប់ប្រទេស | Condo Rental
អ្នកបកប្រែនិងនាំដើរលេង | Guide Service
```

---

### Implementation Notes
1. The message uses Telegram MarkdownV2 formatting, so the Khmer text should work fine (no special characters that need escaping)
2. The `${firstName}` personalization will be removed since the new message doesn't include it
3. The edge function will automatically redeploy after the change

---

### Typo Note
I noticed "Fight Booking" in your text - should this be "**Flight** Booking"?

