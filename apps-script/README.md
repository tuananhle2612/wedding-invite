# Guestbook Apps Script setup

1. Back up the existing RSVP Apps Script project.
2. Replace its server code with [`Code.gs`](./Code.gs), then save.
3. In **Project Settings → Script properties**, set `GUESTBOOK_ADMIN_TOKEN` to exactly six digits (leading zeroes are allowed). Do not put this value in the website source. Avoid reusing a PIN used for banking or other important accounts.
4. Deploy a new version of the existing web app. Keep the same access setting that lets guests submit RSVPs, and keep it executing as the spreadsheet owner.
5. Keep the deployed `/exec` URL in `RSVP_ENDPOINT` in `index.html` (the current value can be retained if updating the existing deployment).

Guestbook messages are stored in a separate `Guestbook` sheet. Visitors can read and add messages; deleting requires the admin PIN, which is checked by Apps Script on every privileged request. Five failed PIN attempts temporarily block guestbook administration for 15 minutes. This is a global limit shared by all visitors, so repeated incorrect attempts can temporarily prevent the owner from managing wishes. Existing RSVP submissions continue to be stored in the `RSVP` sheet.
