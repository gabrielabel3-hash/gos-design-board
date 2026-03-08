import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from './supabase'; // <--- INI KABEL PENGHUBUNG KITA!

// --- SISTEM SUARA ---
const playNotificationSound = () => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime); 
        osc.start(); osc.stop(audioCtx.currentTime + 0.15); 
    } catch(e) {}
};

const playGachaSound = () => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'square'; 
        const now = audioCtx.currentTime;
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.setValueAtTime(400, now + 0.2);
        osc.frequency.setValueAtTime(500, now + 0.4);
        osc.frequency.setValueAtTime(600, now + 0.6);
        osc.frequency.setValueAtTime(700, now + 0.8);
        osc.frequency.setValueAtTime(1200, now + 1.0);
        osc.frequency.setValueAtTime(1600, now + 1.1);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.1);
        gain.gain.setValueAtTime(0.05, now + 0.9);
        gain.gain.linearRampToValueAtTime(0.15, now + 1.0);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
        osc.start(now); osc.stop(now + 1.5);
    } catch(e) {}
};

const getRankInfo = (xp) => {
    if (xp < 500) return { name: 'Warrior', style: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (xp < 1500) return { name: 'Master', style: 'bg-slate-200 text-slate-800 border-slate-400' };
    if (xp < 3500) return { name: 'Grandmaster', style: 'bg-blue-100 text-blue-800 border-blue-300' };
    if (xp < 7000) return { name: 'Epic', style: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    return { name: 'Legend', style: 'bg-purple-100 text-purple-800 border-purple-400 shadow-md font-bold' };
};

export default function App() {
    // State Data dari Database
    const [users, setUsers] = useState([]);
    const [requests, setRequests] = useState([]);
    const [logs, setLogs] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    
    // State UI & Auth
    const [currentUserId, setCurrentUserId] = useState(null); 
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('requester');

    // State Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newReq, setNewReq] = useState({ judul: '', deskripsi: '', designer_id: '' });
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [submitData, setSubmitData] = useState({ preview_url: '', file_link: '' });

    const [toast, setToast] = useState(null);
    const [gacha, setGacha] = useState({ show: false, isRolling: false, title: '', xp: 0, playerName: '' });
    const [draggedTask, setDraggedTask] = useState(null);
    const [dragOverCol, setDragOverCol] = useState(null);

    // --- MENYEDOT DATA DARI SUPABASE (PERTAMA KALI BUKA) ---
    useEffect(() => {
        const fetchDatabase = async () => {
            const { data: dbUsers } = await supabase.from('users').select('*');
            if (dbUsers) setUsers(dbUsers);

            const { data: dbRequests } = await supabase.from('requests').select('*').order('id', { ascending: true });
            if (dbRequests) setRequests(dbRequests);

            const { data: dbLogs } = await supabase.from('logs').select('*').order('id', { ascending: false }).limit(30);
            if (dbLogs) setLogs(dbLogs);

            setIsLoadingData(false);
        };
        fetchDatabase();
    }, []);

    const currentUser = useMemo(() => users.find(u => u.id === currentUserId), [users, currentUserId]);
    const designers = users.filter(u => u.role === 'designer');

    const triggerNotification = (title, body) => {
        playNotificationSound();
        setToast({ title, body, id: Date.now() });
        setTimeout(() => setToast(null), 4500);
    };

    // --- FUNGSI MUTASI (UPDATE KE SUPABASE) ---
    const addLog = async (text) => {
        const now = new Date();
        const time_str = now.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) + ' ' + now.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        const newLog = { time_str, text };
        
        setLogs(prev => [newLog, ...prev]); // Update layar
        await supabase.from('logs').insert([newLog]); // Kirim ke DB
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        if (isRegistering) {
            const newId = 'u' + Date.now();
            const newUser = { id: newId, username, password, name: username, role, xp: 0 }; 
            
            setUsers([...users, newUser]);
            setCurrentUserId(newId);
            await supabase.from('users').insert([newUser]); // Simpan akun ke DB
            addLog(`Akun baru terdaftar: ${username}`);
        } else {
            const user = users.find(u => u.username === username && u.password === password);
            if (user) { 
                setCurrentUserId(user.id); 
                addLog(`${user.name} login.`); 
            } else {
                alert('Username/Password salah!');
            }
        }
        setUsername(''); setPassword('');
    };

    const logout = () => { addLog(`${currentUser.name} logout.`); setCurrentUserId(null); };

    const moveTicket = async (id, newStatus) => {
        const req = requests.find(r => r.id === id);
        setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus } : r)); // Layar
        
        await supabase.from('requests').update({ status: newStatus }).eq('id', id); // Database

        if(newStatus === 'in_progress' && req.status === 'todo') addLog(`${currentUser.name} mulai: '${req.judul}'`);
        if(newStatus === 'todo' && req.status === 'in_progress') addLog(`${currentUser.name} batal: '${req.judul}'`);
        if(newStatus === 'in_progress' && req.status === 'review') {
            addLog(`${currentUser.name} meminta REVISI untuk: '${req.judul}'`);
            triggerNotification("Revisi!", "Requester meminta perubahan desain.");
        }
    };

    const deleteTicket = async (id) => {
        if(window.confirm('Yakin ingin menghapus request ini?')) {
            const req = requests.find(r => r.id === id);
            setRequests(requests.filter(r => r.id !== id));
            await supabase.from('requests').delete().eq('id', id); // Database
            addLog(`${currentUser.name} HAPUS misi: '${req.judul}'`);
        }
    };

    const reassignTicket = async (id, newDesignerId) => {
        const req = requests.find(r => r.id === id);
        const desName = users.find(u => u.id === newDesignerId)?.name;
        setRequests(requests.map(r => r.id === id ? { ...r, designer_id: newDesignerId } : r));
        await supabase.from('requests').update({ designer_id: newDesignerId }).eq('id', id); // Database
        addLog(`Admin mengalihkan misi '${req.judul}' ke ${desName}`);
        triggerNotification("Perubahan Tugas", `Misi dialihkan ke ${desName}`);
    };

    // --- DRAG AND DROP ---
    const handleDragStart = (e, req) => {
        setDraggedTask(req);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => e.target.classList.add('opacity-50', 'scale-95'), 0);
    };

    const handleDragEnd = (e) => {
        e.target.classList.remove('opacity-50', 'scale-95');
        setDraggedTask(null);
        setDragOverCol(null);
    };

    const handleDragOver = (e, colId) => {
        e.preventDefault(); 
        if(dragOverCol !== colId) setDragOverCol(colId);
    };

    const handleDrop = (e, colId) => {
        e.preventDefault();
        setDragOverCol(null);
        if (!draggedTask) return;
        
        const oldStatus = draggedTask.status;
        if (oldStatus === colId) return;

        const role = currentUser.role;

        if (role === 'designer') {
            if (oldStatus === 'todo' && colId === 'in_progress') moveTicket(draggedTask.id, colId);
            else if (oldStatus === 'in_progress' && colId === 'todo') moveTicket(draggedTask.id, colId);
            else if (oldStatus === 'in_progress' && colId === 'review') {
                setSelectedTaskId(draggedTask.id);
                setSubmitData({ preview_url: draggedTask.preview_url || '', file_link: draggedTask.file_link || '' });
                setShowSubmitModal(true);
            } else triggerNotification("Akses Ditolak", "Kamu tidak bisa memindahkan kartu ke jalur itu.");
        } else if (role === 'requester' || role === 'admin') {
            if (oldStatus === 'review' && colId === 'in_progress') moveTicket(draggedTask.id, colId);
            else if (oldStatus === 'review' && colId === 'done') approveTicket(draggedTask); 
            else triggerNotification("Akses Ditolak", "Seret ke 'Done' untuk Approve, atau 'In Progress' untuk Revisi.");
        }
    };

    const rollXp = () => Math.random() < 0.25 ? -(Math.floor(Math.random() * 11) + 5) : Math.floor(Math.random() * 21) + 10;

    const approveTicket = async (req) => {
        const reqXp = rollXp(); 
        const desXp = rollXp(); 
        const reqUser = users.find(u => u.id === req.requester_id);

        setGacha({ show: true, isRolling: true, title: 'VALIDASI MISI...', xp: reqXp, playerName: reqUser?.name });
        playGachaSound();

        setTimeout(async () => {
            setGacha(prev => ({ ...prev, isRolling: false, title: 'HASIL GACHA REQUESTER' }));
            
            // Layar
            setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'done', designer_gacha_available: true, designer_gacha_xp: desXp } : r));
            setUsers(prevUsers => prevUsers.map(u => u.id === req.requester_id ? { ...u, xp: Math.max(0, u.xp + reqXp) } : u));
            
            // Database (Update Request & Update XP Requester)
            await supabase.from('requests').update({ status: 'done', designer_gacha_available: true, designer_gacha_xp: desXp }).eq('id', req.id);
            await supabase.from('users').update({ xp: Math.max(0, reqUser.xp + reqXp) }).eq('id', req.requester_id);
            
            addLog(`${currentUser.name} meng-approve misi '${req.judul}'. Designer mendapat Chest.`);
            triggerNotification("Misi Selesai!", `Pemberitahuan ke Designer: Desainmu di-approve! Cek Chest-mu.`);
        }, 1000); 
    };

    const claimChest = async (req) => {
        const desXp = req.designer_gacha_xp;
        const desName = currentUser.name;

        setGacha({ show: true, isRolling: true, title: 'MEMBUKA CHEST...', xp: desXp, playerName: desName });
        playGachaSound();

        setTimeout(async () => {
            setGacha(prev => ({ ...prev, isRolling: false, title: '🎁 LOOT CHEST DIBUKA!' }));
            
            // Layar
            setRequests(prev => prev.map(r => r.id === req.id ? { ...r, designer_gacha_available: false, designer_gacha_xp: 0 } : r));
            setUsers(prevUsers => prevUsers.map(u => u.id === currentUser.id ? { ...u, xp: Math.max(0, u.xp + desXp) } : u));
            
            // Database
            await supabase.from('requests').update({ designer_gacha_available: false, designer_gacha_xp: 0 }).eq('id', req.id);
            await supabase.from('users').update({ xp: Math.max(0, currentUser.xp + desXp) }).eq('id', currentUser.id);

            addLog(`${currentUser.name} membuka Chest dan mendapat ${desXp} XP.`);
        }, 1000);
    };

    const handleSubmitWork = async (e) => {
        e.preventDefault();
        const req = requests.find(r => r.id === selectedTaskId);
        
        // Layar
        setRequests(requests.map(r => r.id === selectedTaskId ? { ...r, status: 'review', preview_url: submitData.preview_url, file_link: submitData.file_link } : r));
        setShowSubmitModal(false);
        
        // Database
        await supabase.from('requests').update({ status: 'review', preview_url: submitData.preview_url, file_link: submitData.file_link }).eq('id', selectedTaskId);
        
        addLog(`${currentUser.name} mengirim hasil desain misi: '${req.judul}'`);
        triggerNotification("Panggilan Review!", `Pemberitahuan ke Requester: Desain siap diperiksa.`);
    };

    const createRequest = async (e) => {
        e.preventDefault();
        
        // Data Baru
        const newDbReq = { 
            judul: newReq.judul, 
            deskripsi: newReq.deskripsi, 
            status: 'todo', 
            requester_id: currentUser.id, 
            designer_id: newReq.designer_id, 
            preview_url: null, 
            file_link: null, 
            designer_gacha_available: false, 
            designer_gacha_xp: 0 
        };

        // Kirim ke Database dan minta data kembaliannya (karena id di-generate otomatis oleh Supabase)
        const { data: savedReq } = await supabase.from('requests').insert([newDbReq]).select();
        
        if (savedReq && savedReq.length > 0) {
            setRequests([...requests, savedReq[0]]); // Update layar dengan data asli dari DB
        }
        
        setShowCreateModal(false);
        setNewReq({ judul: '', deskripsi: '', designer_id: '' });
        const desName = users.find(u => u.id === newReq.designer_id)?.name;
        addLog(`${currentUser.name} membuat misi '${newReq.judul}'.`);
        triggerNotification("Misi Baru Masuk!", `Halo ${desName}, kamu mendapat tugas.`);
    };

    const visibleRequests = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'admin') return requests;
        if (currentUser.role === 'requester') return requests.filter(r => r.requester_id === currentUser.id);
        if (currentUser.role === 'designer') return requests.filter(r => r.designer_id === currentUser.id);
        return [];
    }, [requests, currentUser]);

    // Layar Loading Awal
    if (isLoadingData) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-bold animate-pulse">Menghubungkan ke Database Supabase...</div>;
    }

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border-t-4 border-blue-600">
                    <h1 className="text-3xl font-black text-center text-slate-800 mb-2">GOS DESIGN <span className="text-blue-600">REQUEST BOARD</span></h1>
                    <p className="text-center text-slate-500 mb-6 text-sm font-medium">Professional Workspace</p>
                    
                    <form onSubmit={handleAuth} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
                            <input required type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full border-2 border-slate-200 p-2.5 rounded-lg focus:border-blue-600 outline-none transition" placeholder="username" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border-2 border-slate-200 p-2.5 rounded-lg focus:border-blue-600 outline-none transition" placeholder="********" />
                        </div>
                        {isRegistering && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Peran (Role)</label>
                                <select value={role} onChange={e => setRole(e.target.value)} className="w-full border-2 border-slate-200 p-2.5 rounded-lg font-medium focus:border-blue-600 outline-none transition">
                                    <option value="requester">Requester (Klien/Peminta)</option>
                                    <option value="designer">Designer (Desainer Grafis)</option>
                                </select>
                            </div>
                        )}
                        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-md">
                            {isRegistering ? 'Daftar Akun Baru (Sign Up)' : 'Login ke Sistem'}
                        </button>
                    </form>
                    
                    <div className="mt-5 text-center text-sm font-medium">
                        <button onClick={() => setIsRegistering(!isRegistering)} className="text-slate-500 hover:text-blue-600 transition">
                            {isRegistering ? 'Sudah punya akun? Login di sini' : 'Belum punya akun? Daftar (Sign Up)'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const columns = [ { id: 'todo', title: 'Quest Board' }, { id: 'in_progress', title: 'On Going' }, { id: 'review', title: 'Validasi' }, { id: 'done', title: 'Clear (Done)' } ];
    const myRank = getRankInfo(currentUser.xp);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800 relative overflow-hidden">
            <style>{`
                @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                @keyframes pulse-fast { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
                .animate-pulse-fast { animation: pulse-fast 0.3s infinite; }
                @keyframes popIn { 0% { transform: scale(0.5); opacity: 0; } 80% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
                .animate-pop { animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                @keyframes glow { 0% { box-shadow: 0 0 5px #fbbf24; } 50% { box-shadow: 0 0 20px #f59e0b, 0 0 10px #fbbf24 inset; } 100% { box-shadow: 0 0 5px #fbbf24; } }
                .btn-chest { animation: glow 2s infinite; }
            `}</style>

            <nav className="bg-white border-b border-slate-200 px-8 py-3 flex justify-between items-center sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4"><h1 className="text-xl font-black text-slate-800">GOS DESIGN <span className="text-blue-600">REQUEST BOARD</span></h1></div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block border-l pl-4 border-slate-200">
                        <div className="text-sm font-bold text-slate-800">{currentUser.name}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">{currentUser.role}</div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full border ${myRank.style} flex items-center gap-2`}>
                        <span className="text-xs font-black uppercase">{myRank.name}</span>
                        <span className="bg-white/50 px-2 py-0.5 rounded text-xs font-bold">{currentUser.xp} XP</span>
                    </div>
                    <button onClick={logout} className="ml-2 text-sm font-bold text-slate-400 hover:text-red-500">X</button>
                </div>
            </nav>

            <div className="max-w-[1400px] mx-auto p-8">
                {currentUser.role === 'admin' && (
                    <div className="flex flex-col lg:flex-row gap-6 mb-8">
                        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex-1">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">👑 Leaderboard</h2>
                            <div className="flex flex-col gap-3">
                                {designers.sort((a,b) => b.xp - a.xp).map((des, index) => {
                                    const r = getRankInfo(des.xp);
                                    return (
                                        <div key={des.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                            <div className="text-xl font-black text-slate-300 w-8">#{index + 1}</div>
                                            <div><div className="font-bold text-sm">{des.name}</div><div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${r.style}`}>{r.name} • {des.xp} XP</div></div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex-1 max-h-48 overflow-y-auto">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">📋 Log Harian</h2>
                            <div className="space-y-2">
                                {logs.map(log => (<div key={log.id} className="text-xs border-b border-slate-100 pb-2 flex gap-3"><span className="text-slate-400 font-mono whitespace-nowrap">[{log.time_str}]</span><span className="text-slate-700 font-medium">{log.text}</span></div>))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Papan Misi</h2>
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">🟢 Supabase Connected</span>
                    </div>
                    {currentUser.role === 'requester' && <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg shadow hover:bg-blue-700 font-bold text-sm transition">+ Buat Misi Baru</button>}
                </div>

                <div className="flex gap-6 overflow-x-auto pb-6 snap-x">
                    {columns.map(col => (
                        <div 
                            key={col.id} 
                            onDragOver={(e) => handleDragOver(e, col.id)}
                            onDrop={(e) => handleDrop(e, col.id)}
                            className={`bg-slate-200/50 p-4 rounded-xl w-80 flex-shrink-0 min-h-[500px] border transition-colors ${dragOverCol === col.id ? 'bg-blue-50 border-blue-400 border-dashed' : 'border-slate-200'}`}
                        >
                            <div className="flex justify-between items-center mb-4 border-b border-slate-300 pb-2">
                                <h2 className="font-bold text-slate-700 uppercase text-sm tracking-wide">{col.title}</h2>
                                <span className="bg-slate-300 text-slate-700 text-xs py-1 px-2.5 rounded-full font-black">{visibleRequests.filter(req => req.status === col.id).length}</span>
                            </div>
                            <div className="space-y-4">
                                {visibleRequests.filter(req => req.status === col.id).map(req => {
                                    const reqUserObj = users.find(u => u.id === req.requester_id);
                                    const desUserObj = users.find(u => u.id === req.designer_id);
                                    const isDraggable = (currentUser.role === 'designer' && (col.id === 'todo' || col.id === 'in_progress')) || 
                                                      ((currentUser.role === 'requester' || currentUser.role === 'admin') && col.id === 'review');

                                    return (
                                    <div key={req.id} draggable={isDraggable} onDragStart={(e) => handleDragStart(e, req)} onDragEnd={handleDragEnd}
                                        className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col transition-all ${isDraggable ? 'cursor-grab hover:border-blue-400 hover:shadow-md' : 'cursor-default'}`}>
                                        
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-black text-slate-800 text-lg leading-tight mb-2">{req.judul}</h3>
                                            {currentUser.role === 'requester' && col.id === 'todo' && <button onClick={() => deleteTicket(req.id)} className="text-slate-300 hover:text-red-500">🗑️</button>}
                                        </div>
                                        <p className="text-sm text-slate-600 font-medium">{req.deskripsi}</p>
                                        
                                        {(req.preview_url || req.file_link) && (
                                            <div className="mt-4">
                                                {req.preview_url && <img src={req.preview_url} alt="Preview" className="w-full h-32 object-cover rounded-lg mb-2 shadow-inner" />}
                                                {req.file_link && <a href={req.file_link} target="_blank" rel="noreferrer" className="text-xs text-blue-700 font-bold flex items-center gap-1 bg-blue-50 py-2 px-3 rounded-lg hover:bg-blue-100">🔗 Buka File</a>}
                                            </div>
                                        )}
                                        
                                        <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] font-bold flex flex-col gap-2">
                                            <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded"><span className="text-slate-500">Req: {reqUserObj?.name}</span></div>
                                            {currentUser.role === 'admin' && col.id !== 'done' ? (
                                                <div className="flex items-center gap-1 bg-amber-50 p-1 rounded border border-amber-100"><span className="text-amber-600 w-1/4">Des:</span><select value={req.designer_id} onChange={(e) => reassignTicket(req.id, e.target.value)} className="w-3/4 bg-white border border-amber-200 rounded p-1 text-[10px] font-bold outline-none">{designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                                            ) : (
                                                <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded"><span className="text-slate-500">Des: {desUserObj?.name || '---'}</span></div>
                                            )}
                                        </div>

                                        <div className="mt-4 flex flex-col gap-2">
                                            {currentUser.role === 'designer' && col.id === 'todo' && <button onClick={() => moveTicket(req.id, 'in_progress')} className="w-full text-xs font-black bg-slate-800 text-white px-3 py-2.5 rounded-lg hover:bg-black">TERIMA MISI</button>}
                                            {currentUser.role === 'designer' && col.id === 'in_progress' && (
                                                <div className="flex gap-2 w-full">
                                                    <button onClick={() => moveTicket(req.id, 'todo')} className="w-1/3 text-[10px] font-black border-2 border-slate-300 text-slate-500 px-1 py-2 rounded-lg">BATAL</button>
                                                    <button onClick={() => { setSelectedTaskId(req.id); setSubmitData({ preview_url: req.preview_url || '', file_link: req.file_link || '' }); setShowSubmitModal(true); }} className="w-2/3 text-[10px] font-black bg-blue-600 text-white px-2 py-2 rounded-lg">KIRIM HASIL</button>
                                                </div>
                                            )}
                                            {(currentUser.role === 'requester' || currentUser.role === 'admin') && col.id === 'review' && (
                                                <div className="flex gap-2 w-full">
                                                    <button onClick={() => moveTicket(req.id, 'in_progress')} className="w-1/3 text-[10px] font-black border-2 border-red-500 text-red-500 px-2 py-2.5 rounded-lg">REVISI</button>
                                                    <button onClick={() => approveTicket(req)} className="w-2/3 text-[10px] font-black bg-gradient-to-r from-red-600 to-amber-500 text-white px-2 py-2.5 rounded-lg shadow-md hover:scale-105 transition">✨ ACC & GACHA</button>
                                                </div>
                                            )}
                                            {currentUser.role === 'designer' && col.id === 'done' && req.designer_gacha_available && (
                                                <button onClick={() => claimChest(req)} className="w-full text-[11px] font-black bg-gradient-to-r from-yellow-400 to-amber-600 text-white px-3 py-3 rounded-lg shadow-lg btn-chest transform hover:scale-105 transition">🎁 BUKA CHEST HADIAH</button>
                                            )}
                                            {col.id === 'done' && !req.designer_gacha_available && (
                                                <div className="w-full text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded text-center">✔️ MISI SELESAI</div>
                                            )}
                                        </div>
                                    </div>
                                )})}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {gacha.show && (
                <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center border-t-8 border-amber-500 relative overflow-hidden">
                        {gacha.isRolling ? (
                            <div className="py-8"><div className="text-6xl mb-4 animate-pulse-fast">🎰</div><h2 className="text-xl font-black text-slate-800 tracking-widest animate-pulse">{gacha.title}</h2></div>
                        ) : (
                            <div className="py-4 animate-pop">
                                <div className="text-6xl mb-4">✨</div><h2 className="text-2xl font-black text-slate-800 mb-6">{gacha.title}</h2>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8 shadow-inner">
                                    <p className="text-sm font-bold text-slate-500 uppercase mb-2">{gacha.playerName}</p>
                                    <p className={`text-4xl font-black ${gacha.xp > 0 ? 'text-green-500' : 'text-red-500'}`}>{gacha.xp > 0 ? `+${gacha.xp}` : gacha.xp} XP</p>
                                    {gacha.xp <= 0 && <p className="text-xs text-red-500 font-bold mt-2">Waduh, lagi apes...</p>}
                                    {gacha.xp >= 25 && <p className="text-xs text-green-600 font-bold mt-2">🔥 HOKI PARAH! 🔥</p>}
                                </div>
                                <button onClick={() => setGacha({ show: false, isRolling: false, title: '', xp: 0, playerName: '' })} className="w-full bg-slate-800 text-white font-black py-3 rounded-lg hover:bg-black shadow-lg uppercase tracking-wide">Ambil Poin</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showSubmitModal && (
                <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-black mb-1 text-slate-800">Kirim Hasil Misi</h2>
                        <form onSubmit={handleSubmitWork} className="space-y-4 mt-4">
                            <div><label className="block text-sm font-bold mb-1">URL Gambar Preview (Wajib)</label><input required type="url" value={submitData.preview_url} onChange={e => setSubmitData({...submitData, preview_url: e.target.value})} className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-sm" placeholder="https://..." /></div>
                            <div><label className="block text-sm font-bold mb-1">Link Master File / Drive</label><input type="url" value={submitData.file_link} onChange={e => setSubmitData({...submitData, file_link: e.target.value})} className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-sm" /></div>
                            <div className="flex justify-end gap-2 mt-6"><button type="button" onClick={() => setShowSubmitModal(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Batal</button><button type="submit" className="px-6 py-2 bg-blue-600 text-white font-black rounded-lg hover:bg-blue-700">Kirim Review</button></div>
                        </form>
                    </div>
                </div>
            )}

            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-black mb-4 text-slate-800">Buat Misi Baru</h2>
                        <form onSubmit={createRequest} className="space-y-4">
                            <div><label className="block text-sm font-bold mb-1">Judul Misi</label><input required type="text" value={newReq.judul} onChange={e => setNewReq({...newReq, judul: e.target.value})} className="w-full border-2 border-slate-200 p-2.5 rounded-lg" /></div>
                            <div><label className="block text-sm font-bold mb-1">Detail Misi</label><textarea required value={newReq.deskripsi} onChange={e => setNewReq({...newReq, deskripsi: e.target.value})} className="w-full border-2 border-slate-200 p-2.5 rounded-lg h-24"></textarea></div>
                            <div><label className="block text-sm font-bold mb-1">Tugaskan ke (Designer)</label>
                                <select required value={newReq.designer_id} onChange={e => setNewReq({...newReq, designer_id: e.target.value})} className="w-full border-2 border-slate-200 p-2.5 rounded-lg font-medium">
                                    <option value="" disabled>-- Pilih Designer --</option>
                                    {designers.map(des => (<option key={des.id} value={des.id}>{des.name}</option>))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 mt-6"><button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Batal</button><button type="submit" className="px-6 py-2 bg-blue-600 text-white font-black rounded-lg shadow-lg">Buat Misi</button></div>
                        </form>
                    </div>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-6 right-6 bg-slate-800 text-white p-4 rounded-xl shadow-2xl z-[100] border-l-4 border-blue-500 animate-slide-up max-w-sm flex gap-3 items-start">
                    <div className="text-2xl mt-1">🔔</div><div><h4 className="font-bold text-sm mb-1">{toast.title}</h4><p className="text-xs text-slate-300">{toast.body}</p></div>
                </div>
            )}
        </div>
    );
}