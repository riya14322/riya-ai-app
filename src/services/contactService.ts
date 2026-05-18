export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  relation?: string;
}

export const mockContacts: Contact[] = [
  { id: "1", name: "Rahul", phone: "+919876543210", email: "rahul@example.com", relation: "Friend" },
  { id: "2", name: "Mom", phone: "+919999999999", relation: "Family" },
  { id: "3", name: "Dad", phone: "+918888888888", relation: "Family" },
  { id: "4", name: "Priya", phone: "+917777777777", email: "priya@example.com", relation: "Sister" },
  { id: "5", name: "Chef", phone: "+916666666666", relation: "Work" },
  { id: "6", name: "Delivery Guy", phone: "+915555555555", relation: "Services" }
];

export function searchContacts(query: string): Contact[] {
  const lowQuery = query.toLowerCase();
  return mockContacts.filter(c => 
    c.name.toLowerCase().includes(lowQuery) || 
    c.phone.includes(query)
  );
}
