# Guestbook Apps Script setup

1. Back up the existing RSVP Apps Script project.
2. Replace its server code with [`Code.gs`](./Code.gs), then save.
3. In **Project Settings → Script properties**, add `GUESTBOOK_ADMIN_TOKEN` with a unique password of at least 20 characters. Do not put this value in the website source.
4. Deploy a new version of the existing web app. Keep the same access setting that lets guests submit RSVPs, and keep it executing as the spreadsheet owner.
5. Keep the deployed `/exec` URL in `RSVP_ENDPOINT` in `index.html` (the current value can be retained if updating the existing deployment).

Guestbook messages are stored in a separate `Guestbook` sheet. Visitors can read and add messages; deleting requires the admin token, which is checked by Apps Script on every privileged request. Existing RSVP submissions continue to be stored in the `RSVP` sheet.
