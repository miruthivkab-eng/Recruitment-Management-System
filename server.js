const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = __dirname;

// Ensure necessary directories exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Database helper functions
function getDB() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initialData = { jobs: [], candidates: [], interviews: [] };
            fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading database:', err);
        return { jobs: [], candidates: [], interviews: [] };
    }
}

function saveDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error('Error saving database:', err);
        return false;
    }
}

// MIME types dictionary for static server
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

// Create HTTP Server
const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);

    // --- REST API ENDPOINTS ---

    // 1. GET /api/stats - Dashboard analytics counts
    if (pathname === '/api/stats' && req.method === 'GET') {
        const db = getDB();
        const stats = {
            totalJobs: db.jobs.length,
            activeJobs: db.jobs.filter(j => j.status === 'Active').length,
            totalCandidates: db.candidates.length,
            shortlisted: db.candidates.filter(c => c.stage === 'Shortlisted').length,
            interviewsScheduled: db.interviews.length,
            hired: db.candidates.filter(c => c.stage === 'Hired').length
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
        return;
    }

    // 2. GET /api/jobs - List job vacancies
    if (pathname === '/api/jobs' && req.method === 'GET') {
        const db = getDB();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(db.jobs));
        return;
    }

    // 3. POST /api/jobs - Create job vacancy
    if (pathname === '/api/jobs' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const jobData = JSON.parse(body);
                const db = getDB();
                
                const newJob = {
                    id: 'JOB-' + Math.floor(100 + Math.random() * 900),
                    title: jobData.title || 'Untitled Vacancy',
                    department: jobData.department || 'General',
                    location: jobData.location || 'Remote',
                    type: jobData.type || 'Full-Time',
                    experience: jobData.experience || 'Fresher',
                    salary: jobData.salary || 'Negotiable',
                    skills: Array.isArray(jobData.skills) ? jobData.skills : (jobData.skills || '').split(',').map(s => s.trim()).filter(Boolean),
                    description: jobData.description || '',
                    status: 'Active',
                    postedDate: new Date().toISOString().split('T')[0]
                };

                db.jobs.unshift(newJob);
                saveDB(db);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, job: newJob }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Invalid JSON body' }));
            }
        });
        return;
    }

    // 4. GET /api/candidates - List candidates
    if (pathname === '/api/candidates' && req.method === 'GET') {
        const db = getDB();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(db.candidates));
        return;
    }

    // 5. POST /api/candidates - Candidate registration with resume upload
    if (pathname === '/api/candidates' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const candidateData = JSON.parse(body);
                const db = getDB();

                let resumeFilename = 'sample_resume_rahul.pdf';
                let resumeOriginalName = 'Resume.pdf';

                if (candidateData.resumeFileBase64 && candidateData.resumeFileName) {
                    const fileBuffer = Buffer.from(candidateData.resumeFileBase64.split(',')[1] || candidateData.resumeFileBase64, 'base64');
                    const safeName = Date.now() + '_' + candidateData.resumeFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
                    fs.writeFileSync(path.join(UPLOADS_DIR, safeName), fileBuffer);
                    resumeFilename = safeName;
                    resumeOriginalName = candidateData.resumeFileName;
                }

                const matchedJob = db.jobs.find(j => j.id === candidateData.jobId);
                const jobTitle = matchedJob ? matchedJob.title : (candidateData.jobTitle || 'General Application');

                const newCandidate = {
                    id: 'CAND-' + Math.floor(100 + Math.random() * 900),
                    name: candidateData.name || 'Anonymous Candidate',
                    email: candidateData.email || '',
                    phone: candidateData.phone || '',
                    jobId: candidateData.jobId || '',
                    jobTitle: jobTitle,
                    experience: candidateData.experience || '0 Years',
                    skills: Array.isArray(candidateData.skills) ? candidateData.skills : (candidateData.skills || '').split(',').map(s => s.trim()).filter(Boolean),
                    coverLetter: candidateData.coverLetter || '',
                    stage: 'Applied',
                    matchScore: Math.floor(75 + Math.random() * 21),
                    resumeFilename: resumeFilename,
                    resumeOriginalName: resumeOriginalName,
                    appliedDate: new Date().toISOString().split('T')[0]
                };

                db.candidates.unshift(newCandidate);
                saveDB(db);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, candidate: newCandidate }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: err.message || 'Invalid candidate data' }));
            }
        });
        return;
    }

    // 6. PUT /api/candidates/:id/stage - Update stage / shortlist
    if (pathname.startsWith('/api/candidates/') && pathname.endsWith('/stage') && req.method === 'PUT') {
        const parts = pathname.split('/');
        const candidateId = parts[3];

        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { stage } = JSON.parse(body);
                const db = getDB();
                const candidate = db.candidates.find(c => c.id === candidateId);

                if (!candidate) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Candidate not found' }));
                    return;
                }

                candidate.stage = stage;
                saveDB(db);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, candidate }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Invalid payload' }));
            }
        });
        return;
    }

    // 7. GET /api/interviews - List scheduled interviews
    if (pathname === '/api/interviews' && req.method === 'GET') {
        const db = getDB();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(db.interviews));
        return;
    }

    // 8. POST /api/interviews - Schedule new interview
    if (pathname === '/api/interviews' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const interviewData = JSON.parse(body);
                const db = getDB();

                const candidate = db.candidates.find(c => c.id === interviewData.candidateId);
                if (candidate) {
                    candidate.stage = 'Interview Scheduled';
                }

                const newInterview = {
                    id: 'INT-' + Math.floor(100 + Math.random() * 900),
                    candidateId: interviewData.candidateId || '',
                    candidateName: candidate ? candidate.name : (interviewData.candidateName || 'Candidate'),
                    jobTitle: candidate ? candidate.jobTitle : (interviewData.jobTitle || 'Role'),
                    interviewer: interviewData.interviewer || 'Hiring Manager',
                    date: interviewData.date || new Date().toISOString().split('T')[0],
                    time: interviewData.time || '10:00',
                    stage: interviewData.stage || 'Technical Round',
                    meetLink: interviewData.meetLink || 'https://meet.google.com/new',
                    notes: interviewData.notes || '',
                    status: 'Scheduled'
                };

                db.interviews.unshift(newInterview);
                saveDB(db);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, interview: newInterview }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Invalid payload' }));
            }
        });
        return;
    }

    // --- UPLOADS FILE SERVING (/uploads/:file) ---
    if (pathname.startsWith('/uploads/')) {
        const fileName = path.basename(pathname);
        const filePath = path.join(UPLOADS_DIR, fileName);

        if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
        }
        return;
    }

    // --- STATIC FILES SERVING (/public/*) ---
    let safePath = pathname === '/' ? '/index.html' : pathname;
    let filePath = path.join(PUBLIC_DIR, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'text/html';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    } else {
        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            fs.createReadStream(indexPath).pipe(res);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('RMS Server Running');
        }
    }
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` 🚀 Recruitment Management System (RMS) Server`);
    console.log(` 🌐 URL: http://localhost:${PORT}`);
    console.log(`====================================================`);
});