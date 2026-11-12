// SAMPLE CONTENT for test builds that are not connected to the backend
// (no EXPO_PUBLIC_SUPABASE_URL / ANON_KEY). As soon as a backend is configured
// this file is not used: all content then comes from the admin website.
//
// Links and documents are the live app's own URLs (MRM URL List supplied by the
// owner, 12 Nov 2026). Phone numbers are from screenshots of the live app.
// HR & Payroll matches the live app: same order, two folders, live labels and icons.
import type { Attachment, Entry, EntryKind, MessageRow, Section, SectionType } from './api';

const FILES = 'https://storage.googleapis.com/gs.appbuild.io/apps/mcarthur/attachments/';
const T = '2026-11-12T00:00:00Z';

const SECTIONS: [string, string, SectionType, string?][] = [
  ['home', 'Home', 'home'],
  ['flight', 'Flight Tracker', 'web', 'https://flightaware.com/live/airport/YMHU'],
  ['timetables', 'Timetables', 'list'],
  ['weather', 'Weather', 'weather', 'https://www.willyweather.com.au/nt/katherine/mcarthur-river-mine-airport.html'],
  ['messages', 'Employee Messages', 'messages'],
  ['village', 'MRM Village', 'list'],
  ['wellbeing', 'Wellbeing', 'list'],
  ['hr', 'HR & Payroll', 'list'],
  ['memorandum', 'Memorandum', 'list'],
  ['report', 'Report & Fix It', 'list'],
  ['call', 'Call Us', 'list'],
  ['find', 'Find Us', 'list'],
  ['settings', 'Settings', 'settings'],
];

// Owner's WillyWeather widget for McArthur River Mine Airport (12 Nov 2026).
const WEATHER_WIDGET = '<div style="width: 400px;"><iframe style="display: block;" src="https://cdnres.willyweather.com.au/widget/loadView.html?id=80085" width="400" height="520" frameborder="0" scrolling="no"></iframe><a style="margin: -20px 0 0 0;text-indent: -9999em;height: 20px;z-index: 1;position: relative;display: block" href="https://www.willyweather.com.au/nt/katherine/mcarthur-river-mine-airport.html" rel="nofollow">https://www.willyweather.com.au/nt/katherine/mcarthur-river-mine-airport.html</a></div>';

export const sampleSections: Section[] = SECTIONS.map(([key, label, section_type, url], i) => ({
  id: `sample-${key}`, key, label, position: (i + 1) * 10, section_type,
  sort_mode: key === 'memorandum' ? 'newest_first' : 'manual', url: url ?? null,
  widget_html: key === 'weather' ? WEATHER_WIDGET : null,
}));

type Item = [string, EntryKind, string | null, string?, string?, Item[]?]; // label, kind, value, created, icon, folder items
const withIcon = (icon: string) => (it: Item): Item => [it[0], it[1], it[2], it[3], icon, it[5]];
const folder = (label: string, icon: string, items: Item[]): Item => [label, 'folder', null, undefined, icon, items];
const pdf = (label: string, file: string, created?: string): Item => [label, 'pdf', FILES + file, created];
const link = (label: string, url: string | null): Item => [label, 'url', url];
const phone = (label: string, number: string): Item => [label, 'phone', number];

const ITEMS: Record<string, Item[]> = {
  timetables: [
    pdf('Flight Timetable', 'App_Content_2024-07-25_Flight_Schedule.pdf'),
    pdf('Community Bus Timetable', 'Community_Bus_Timetable.pdf'),
    pdf('Site Bus Timetable', 'Bus_Timetable_of_Dec_2024.pdf'),
  ],
  village: [
    pdf('Village Map', '2025_Village_Map_-_WET_MESS_HOURS_UPDATED.pdf'),
    pdf('Menu', '12.11.26.pdf'),
    pdf('MRM Gun Club', 'MAP-GM-0010-2300001.pdf'),
  ],
  wellbeing: [
    link('Book Psychologist', 'https://www.surveymonkey.com/r/MRM_Appt'),
    link('Employee Assistance Program', 'https://assureprograms.com.au/'),
    link('R U OK?', 'https://www.ruok.org.au/how-to-ask'),
    pdf('Declaration of Prescription Medication', 'Declaration_of_Prescription_Medication.pdf'),
    pdf('Well for Work Declaration', 'Well_For_Work_Declaration.pdf'),
  ],
  hr: [
    folder('Benefits & Rewards', 'handshake-outline', [
      pdf('MRM Employee travel with Airnorth', 'Airnorth_MRM_Employee_Travel_-_App_24-07-23.pdf'),
      pdf('Bupa Corporate Health Insurance Phone Consults', 'Bupa_Glencore_June_July.pdf'),
      pdf('Corporate Travel Offer - Air Canada', 'Corporate-Leisure_QR-Code_EN.pdf'),
      pdf('Medibank Private 2', 'Medibank_Private___Glencore_Group.pdf'),
      pdf('Salary Packaging - RemServ', 'Remote_Area_Flights.pdf'),
      pdf('Glencore Rewards', 'Glencore__Reward_Gateway_Welcome_Poster_2_29092021.pdf'),
      pdf('Advance learning Platform', 'Advance_Learning_Platform.pdf'),
      pdf('Employee Rewards and Benefits', 'MRM_Employee_Benefits_-_Rewards.pdf'),
    ].map(withIcon('handshake-outline'))),
    withIcon('account-group-outline')(pdf('MRM HR Team Contact List', 'MRM_HR_Team_Contact_List.pdf')),
    withIcon('briefcase-outline')(pdf('Career Opportunities', 'MRM_Career_opportunities_-_IOS_ratio.pdf')),
    folder('MRM Enterprise Agreement', 'handshake-outline', [
      ['McArthur River Mining Pty Ltd Enterprise Agreement 2019', 'pdf', null] as Item, // not in the URL List yet
      pdf('McArthur River Mining Pty Ltd Enterprise Agreement 2025', 'McArthur_River_Mining_Pty_Ltd_Enterprise_Agreement_2025.pdf'),
      pdf('MRM EA 2025 Classifications and Pay Rates', 'MRM_EA_2025_Classifications_and_pay_rates.pdf'),
      pdf('MRM EA 2026 Classifications and Pay Rates', 'MRM_EA_2026_Classifications_and_Pay_Rates.pdf'),
    ].map(withIcon('handshake-outline'))),
    withIcon('clipboard-text-outline')(link('Leave Request Update', 'https://mcarthurrivermine.wufoo.com/forms/mjeybgg139u8ra/')),
    withIcon('clipboard-text-outline')(link('Overtime Request Update', 'https://www.surveymonkey.com/r/MRM_Overtime_Request')),
    withIcon('calendar-clock-outline')(pdf('Payroll Schedule - 2026/27', 'Payroll_Schedule_26-27.pdf')),
    withIcon('calendar-clock-outline')(pdf('Payslip Guide', 'Payslip_Guide_2025b.pdf')),
    withIcon('clipboard-text-outline')(link('Northern Territory Residency Payment - EA Employees', null)), // blank in the live app
  ],
  memorandum: [
    pdf('25th May 2026', '20260525_Memorandum.pdf', '2026-05-25T00:00:00Z'),
    pdf('27 March 2026', '20260327_Memorandum.pdf', '2026-03-27T00:00:00Z'),
  ],
  report: [link('Report & Fix It', 'https://www.surveymonkey.com/r/mrm_report_fixit')],
  call: [
    phone('Call Emergency', '+61 8 8975 8222'),
    phone('Call Safety', '+61 427 964 158'),
    phone('Call First Aid Centre', '+61 8 8975 8121'),
    phone('Call Airport', '+61 8 8975 8164'),
    phone('Call Human Resources', '+61 8 8975 8234'),
  ],
  find: [
    link('MRM Website', 'https://www.mcarthurrivermine.com.au'),
    link('Glencore Australia', 'https://www.glencore.com.au/ask-glencore-australia'),
    link('Glencore Global', 'https://www.glencore.com'),
    link('MRM Facebook', 'https://www.facebook.com/GlencoreMcArthurRiverMine'),
  ],
};

function build(parent: string, items: Item[]): Entry[] {
  return items.flatMap(([label, kind, value, created, icon, children], i) => {
    const id = `${parent}-${i + 1}`;
    const self: Entry = {
      id, parent_id: parent, kind, label, position: (i + 1) * 10,
      url: kind === 'url' ? value : null,
      phone: kind === 'phone' ? value : null,
      file_path: kind === 'pdf' ? value : null,
      body: null, file_updated_at: kind === 'pdf' && value ? T : null, created_at: created ?? T, is_demo: false, icon: icon ?? null,
    };
    return [self, ...(children ? build(id, children) : [])];
  });
}

export const sampleEntries: Entry[] = Object.entries(ITEMS).flatMap(([key, items]) => build(`sample-${key}`, items));

// Employee Messages: the two messages listed for the live app, each with its PDF.
const MESSAGES: (MessageRow & { file: string; name: string })[] = [
  {
    id: 'sample-msg-2', source_label: 'McArthur River Mine', scope: 'global_general', created_at: '2026-03-23T06:00:00Z',
    body: 'Ex-TC Narelle update and return to normal operations (23 March 2026, 3:30 pm). Open the attached document for details.',
    file: '23_March_2026_330_PM_Ex-TC_Narelle_Update_and_Return_to_Normal_Operations.pdf', name: 'Ex-TC Narelle update, 23 March 2026.pdf',
  },
  {
    id: 'sample-msg-1', source_label: 'McArthur River Mine', scope: 'global_general', created_at: '2026-03-22T06:00:00Z',
    body: 'Ex-TC Narelle update and staged return to normal operations (22 March 2026, 3:30 pm). Open the attached document for details.',
    file: '22_March_2026_330pm_Ex-TC_Nareelle_Update_and__Staged_Return_to_Normal_Operations.pdf', name: 'Ex-TC Narelle update, 22 March 2026.pdf',
  },
];

export const sampleMessages: MessageRow[] = MESSAGES.map(({ file: _f, name: _n, ...m }) => m);

export function sampleMessage(id: string): { message: MessageRow; attachments: Attachment[] } | null {
  const m = MESSAGES.find((x) => x.id === id);
  if (!m) return null;
  const { file, name, ...message } = m;
  return {
    message,
    attachments: [{ id: `${id}-a`, message_id: id, file_path: FILES + file, file_name: name, mime_type: 'application/pdf', position: 0 }],
  };
}
