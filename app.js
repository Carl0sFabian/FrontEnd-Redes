document.addEventListener('DOMContentLoaded', () => {
    
    let backendUrl = localStorage.getItem('edubridge_backend_url');
    if (!backendUrl || backendUrl === 'http://localhost:8012/edubridge-backend' || backendUrl === 'http://localhost:8012') {
        backendUrl = 'https://backend-redes-kbr6.onrender.com';
        localStorage.setItem('edubridge_backend_url', backendUrl);
    }
    document.getElementById('backend-url').value = backendUrl;

    
    const backendUrlInput = document.getElementById('backend-url');
    const saveConfigBtn = document.getElementById('save-config-btn');
    const toastContainer = document.getElementById('toast-container');

    let chartUsers = null;
    let chartSedes = null;
    let chartMaterials = null;

    
    let cachedUsers = [];
    let cachedCourses = [];

    
    saveConfigBtn.addEventListener('click', () => {
        let url = backendUrlInput.value.trim();
        if (url.endsWith('/')) {
            url = url.slice(0, -1); 
        }
        backendUrl = url;
        localStorage.setItem('edubridge_backend_url', backendUrl);
        showToast('URL del backend guardada exitosamente.', 'success');
        updateCounters();
    });

    
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fa-check-circle';
        if (type === 'danger') icon = 'fa-exclamation-circle';
        if (type === 'warning') icon = 'fa-exclamation-triangle';

        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `;
        toastContainer.appendChild(toast);

        
        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) reverse forwards';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    }

    
    const menuItems = document.querySelectorAll('.menu-item');
    const appViews = document.querySelectorAll('.app-view');
    const viewTitle = document.getElementById('view-title');

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetViewId = item.getAttribute('data-view');
            
            
            menuItems.forEach(mi => mi.classList.remove('active'));
            item.classList.add('active');

            
            appViews.forEach(view => view.classList.remove('active'));
            const targetView = document.getElementById(targetViewId);
            if (targetView) {
                targetView.classList.add('active');
            }

            
            viewTitle.textContent = item.textContent.trim();

            
            onViewChange(targetViewId);
        });
    });

    
    function onViewChange(viewId) {
        if (viewId === 'view-dashboard') {
            updateCounters();
        } else if (viewId === 'view-users') {
            loadUsers();
        } else if (viewId === 'view-courses') {
            loadCoursesData();
        } else if (viewId === 'view-materials') {
            loadMaterialsData();
        } else if (viewId === 'view-attendance') {
            loadAttendances('all');
            loadRfidSimStudents();
        } else if (viewId === 'view-performance') {
            loadPerformanceData();
        }
    }

    // Connection testing removed from button, keeping testConnection utility if needed

    async function testConnection() {
        showToast('Probando conexión con el backend...', 'warning');
        try {
            const response = await fetch(`${backendUrl}/api/usuarios/get.php`);
            if (response.ok) {
                showToast('¡Conexión establecida con éxito! El backend responde correctamente.', 'success');
                updateCounters();
            } else {
                throw new Error(`Código de estado HTTP: ${response.status}`);
            }
        } catch (error) {
            console.error(error);
            showToast('Error de conexión. Verifica que el backend esté corriendo y que CORS esté habilitado.', 'danger');
        }
    }

    async function updateCounters() {
        try {
            
            const resUsers = await fetch(`${backendUrl}/api/usuarios/get.php`);
            const users = resUsers.ok ? await resUsers.json() : [];
            document.getElementById('count-users').textContent = Array.isArray(users) ? users.length : 0;

            const resCourses = await fetch(`${backendUrl}/api/cursos/get.php`);
            const courses = resCourses.ok ? await resCourses.json() : [];
            document.getElementById('count-courses').textContent = Array.isArray(courses) ? courses.length : 0;

            const resMaterials = await fetch(`${backendUrl}/api/materiales/get.php`);
            const materials = resMaterials.ok ? await resMaterials.json() : [];
            document.getElementById('count-materials').textContent = Array.isArray(materials) ? materials.length : 0;

            const resAttendance = await fetch(`${backendUrl}/api/asistencias/get.php`);
            const attendances = resAttendance.ok ? await resAttendance.json() : [];
            document.getElementById('count-attendance').textContent = Array.isArray(attendances) ? attendances.length : 0;

            // Draw and refresh dashboard charts
            initDashboardCharts(users, courses, materials, attendances);
        } catch (e) {
            console.warn("No se pudieron cargar todos los contadores rápidos: " + e.message);
        }
    }

    function initDashboardCharts(users, courses, materials, attendances) {
        if (chartUsers) chartUsers.destroy();
        if (chartSedes) chartSedes.destroy();
        if (chartMaterials) chartMaterials.destroy();

        // 1. User Distribution
        const userTypes = { 'Estudiante': 0, 'Docente': 0, 'Admin': 0 };
        if (Array.isArray(users)) {
            users.forEach(u => {
                const tipo = u.tipo || 'Estudiante';
                if (userTypes.hasOwnProperty(tipo)) {
                    userTypes[tipo]++;
                } else {
                    userTypes[tipo] = 1;
                }
            });
        }

        const ctxUsers = document.getElementById('chart-users-distribution').getContext('2d');
        chartUsers = new Chart(ctxUsers, {
            type: 'doughnut',
            data: {
                labels: Object.keys(userTypes),
                datasets: [{
                    data: Object.values(userTypes),
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981'],
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#f3f4f6', padding: 15, font: { family: 'Inter', size: 12 } }
                    }
                }
            }
        });

        // 2. Attendance by Sede
        const sedes = {};
        if (Array.isArray(attendances)) {
            attendances.forEach(a => {
                const Sede = a.sede || 'Sin Sede';
                sedes[Sede] = (sedes[Sede] || 0) + 1;
            });
        }

        const ctxSedes = document.getElementById('chart-attendance-sedes').getContext('2d');
        chartSedes = new Chart(ctxSedes, {
            type: 'bar',
            data: {
                labels: Object.keys(sedes),
                datasets: [{
                    label: 'Registros',
                    data: Object.values(sedes),
                    backgroundColor: 'rgba(139, 92, 246, 0.65)',
                    borderColor: '#8b5cf6',
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { ticks: { color: '#9ca3af', font: { family: 'Inter' } }, grid: { display: false } },
                    y: { ticks: { color: '#9ca3af', font: { family: 'Inter' }, precision: 0 }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
                }
            }
        });

        // 3. Materials by Course
        const courseMaterials = {};
        const courseMap = {};
        if (Array.isArray(courses)) {
            courses.forEach(c => {
                courseMap[c.id] = c.nombre;
                courseMaterials[c.nombre] = 0;
            });
        }
        if (Array.isArray(materials)) {
            materials.forEach(m => {
                const courseName = m.curso_nombre || courseMap[m.id_curso] || 'Otros';
                courseMaterials[courseName] = (courseMaterials[courseName] || 0) + 1;
            });
        }

        const ctxMaterials = document.getElementById('chart-materials-courses').getContext('2d');
        chartMaterials = new Chart(ctxMaterials, {
            type: 'bar',
            data: {
                labels: Object.keys(courseMaterials),
                datasets: [{
                    label: 'Materiales subidos',
                    data: Object.values(courseMaterials),
                    backgroundColor: 'rgba(16, 185, 129, 0.65)',
                    borderColor: '#10b981',
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                indexAxis: 'y',
                scales: {
                    x: { ticks: { color: '#9ca3af', font: { family: 'Inter' }, precision: 0 }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                    y: { ticks: { color: '#9ca3af', font: { family: 'Inter' } }, grid: { display: false } }
                }
            }
        });
    }

    
    const userModalOverlay = document.getElementById('user-modal-overlay');
    const btnOpenUserModal = document.getElementById('btn-open-user-modal');
    const btnCloseUserModal = document.getElementById('btn-close-user-modal');
    const btnCancelUserModal = document.getElementById('btn-cancel-user-modal');
    const formCreateUser = document.getElementById('form-create-user');
    const tbodyUsers = document.getElementById('tbody-users');

    
    btnOpenUserModal.addEventListener('click', () => userModalOverlay.classList.add('active'));
    btnCloseUserModal.addEventListener('click', () => userModalOverlay.classList.remove('active'));
    btnCancelUserModal.addEventListener('click', () => userModalOverlay.classList.remove('active'));

    async function loadUsers() {
        tbodyUsers.innerHTML = `<tr><td colspan="9" style="text-align:center;"><div class="loading-spinner"></div></td></tr>`;
        try {
            
            const [resUsers, resEnrollments, resAttendances] = await Promise.all([
                fetch(`${backendUrl}/api/usuarios/get.php`),
                fetch(`${backendUrl}/api/inscripciones/get.php`).catch(() => null),
                fetch(`${backendUrl}/api/asistencias/get.php`).catch(() => null)
            ]);

            if (!resUsers.ok) throw new Error("No se encontraron registros");
            const users = await resUsers.json();
            
            let enrollments = [];
            if (resEnrollments && resEnrollments.ok) {
                try { enrollments = await resEnrollments.json(); } catch (e) { console.warn(e); }
            }

            let attendances = [];
            if (resAttendances && resAttendances.ok) {
                try { attendances = await resAttendances.json(); } catch (e) { console.warn(e); }
            }

            
            const enrollmentsMap = {};
            if (Array.isArray(enrollments)) {
                enrollments.forEach(en => {
                    const studentId = en.id_estudiante;
                    if (!enrollmentsMap[studentId]) {
                        enrollmentsMap[studentId] = [];
                    }
                    if (en.curso_nombre && !enrollmentsMap[studentId].includes(en.curso_nombre)) {
                        enrollmentsMap[studentId].push(en.curso_nombre);
                    }
                });
            }

            
            const lastAttendanceMap = {};
            if (Array.isArray(attendances)) {
                attendances.forEach(att => {
                    const userId = att.id_usuario;
                    if (!lastAttendanceMap[userId] || att.fecha_hora > lastAttendanceMap[userId].fecha_hora) {
                        lastAttendanceMap[userId] = {
                            fecha_hora: att.fecha_hora,
                            sede: att.sede
                        };
                    }
                });
            }

            cachedUsers = Array.isArray(users) ? users : [];
            
            if (cachedUsers.length === 0) {
                tbodyUsers.innerHTML = `<tr><td colspan="9" class="empty-state"><i class="fa-solid fa-users-slash"></i><p>No hay usuarios registrados.</p></td></tr>`;
                return;
            }

            tbodyUsers.innerHTML = cachedUsers.map(user => {
                let coursesHtml = '<span style="color: var(--text-muted)">N/A</span>';
                let locationHtml = '<span style="color: var(--text-muted)">N/A</span>';

                if (user.tipo === 'Estudiante') {
                    const studentCourses = enrollmentsMap[user.id] || [];
                    if (studentCourses.length > 0) {
                        coursesHtml = studentCourses.map(c => `<span class="badge badge-purple" style="margin: 2px 0; display: inline-block;">${c}</span>`).join('<br>');
                    } else {
                        coursesHtml = '<span style="color: var(--text-muted)">Sin matricular</span>';
                    }

                    const lastLoc = lastAttendanceMap[user.id];
                    if (lastLoc) {
                        locationHtml = `<span class="badge badge-blue">${lastLoc.sede}</span>`;
                    } else {
                        locationHtml = '<span style="color: var(--text-muted)">Sin registros</span>';
                    }
                }

                return `
                    <tr>
                        <td>${user.id}</td>
                        <td><code style="color: var(--primary-color)">${user.codigo}</code></td>
                        <td style="font-weight: 500">${user.nombre_completo}</td>
                        <td>${user.correo}</td>
                        <td><span class="badge ${user.tipo === 'Administrador' ? 'badge-red' : user.tipo === 'Docente' ? 'badge-purple' : 'badge-blue'}">${user.tipo}</span></td>
                        <td>${coursesHtml}</td>
                        <td>${locationHtml}</td>
                        <td style="font-size: 0.8rem; color: var(--text-muted)">${user.fecha_creacion || '-'}</td>
                        <td>
                            <div class="btn-group">
                                <button class="btn btn-primary btn-sm view-qr-btn" data-id="${user.id}" data-codigo="${user.codigo}" data-nombre="${user.nombre_completo}">
                                    <i class="fa-solid fa-qrcode"></i> Credencial
                                </button>
                                <button class="btn btn-secondary btn-sm delete-user-btn" data-id="${user.id}">
                                    <i class="fa-solid fa-trash-can" style="color:var(--danger-color)"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            
            document.querySelectorAll('.delete-user-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    if (confirm('¿Estás seguro de eliminar este usuario?')) {
                        deleteUser(id);
                    }
                });
            });

            
            document.querySelectorAll('.view-qr-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const codigo = btn.getAttribute('data-codigo');
                    const nombre = btn.getAttribute('data-nombre');
                    openQrModal(id, codigo, nombre);
                });
            });

        } catch (error) {
            tbodyUsers.innerHTML = `<tr><td colspan="9" class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Error al cargar usuarios o base de datos vacía.</p></td></tr>`;
        }
    }

    async function deleteUser(id) {
        try {
            const response = await fetch(`${backendUrl}/api/usuarios/delete.php`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
            const resData = await response.json();
            if (response.ok) {
                showToast(resData.message || 'Usuario eliminado con éxito.', 'success');
                loadUsers();
            } else {
                showToast(resData.message || 'No se pudo eliminar el usuario.', 'danger');
            }
        } catch (e) {
            showToast('Error de red al intentar eliminar el usuario.', 'danger');
        }
    }

    formCreateUser.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            codigo: document.getElementById('user-code').value.trim(),
            nombre_completo: document.getElementById('user-name').value.trim(),
            correo: document.getElementById('user-email').value.trim(),
            tipo: document.getElementById('user-type').value,
            password: document.getElementById('user-password').value
        };

        try {
            const response = await fetch(`${backendUrl}/api/usuarios/post.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const resData = await response.json();

            if (response.status === 201) {
                showToast(resData.message || 'Usuario registrado exitosamente.', 'success');
                formCreateUser.reset();
                userModalOverlay.classList.remove('active');
                loadUsers();
            } else {
                showToast(resData.message || 'No se pudo registrar el usuario.', 'danger');
            }
        } catch (e) {
            showToast('Error al enviar la petición al servidor.', 'danger');
        }
    });

    
    const selectTeacher = document.getElementById('course-teacher');
    const selectStudentEnroll = document.getElementById('enroll-student-id');
    const selectCourseEnroll = document.getElementById('enroll-course-id');
    const selectCourseMaterial = document.getElementById('material-course');
    const selectStudentPerf = document.getElementById('perf-student');
    const selectCoursePerf = document.getElementById('perf-course');

    const formCreateCourse = document.getElementById('form-create-course');
    const formEnrollStudent = document.getElementById('form-enroll-student');
    const tbodyCourses = document.getElementById('tbody-courses');

    async function loadCoursesData() {
        
        await fillDropdowns();
        
        loadCourses();
    }

    async function fillDropdowns() {
        try {
            
            const response = await fetch(`${backendUrl}/api/usuarios/get.php`);
            if (response.ok) {
                const users = await response.json();
                
                
                const teachers = users.filter(u => u.tipo === 'Docente');
                selectTeacher.innerHTML = '<option value="">Selecciona un docente...</option>' + 
                    teachers.map(t => `<option value="${t.id}">${t.nombre_completo} (${t.codigo})</option>`).join('');

                
                const students = users.filter(u => u.tipo === 'Estudiante');
                
                const studentOptions = '<option value="">Selecciona un estudiante...</option>' + 
                    students.map(s => `<option value="${s.id}">${s.nombre_completo} (${s.codigo})</option>`).join('');
                
                selectStudentEnroll.innerHTML = studentOptions;
                selectStudentPerf.innerHTML = studentOptions;
            }

            
            const resCourses = await fetch(`${backendUrl}/api/cursos/get.php`);
            if (resCourses.ok) {
                const courses = await resCourses.json();
                cachedCourses = courses;

                const courseOptions = '<option value="">Selecciona un curso...</option>' + 
                    courses.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
                
                selectCourseEnroll.innerHTML = courseOptions;
                selectCourseMaterial.innerHTML = courseOptions;
                selectCoursePerf.innerHTML = courseOptions;
            }
        } catch (e) {
            console.error("Error al rellenar desplegables: " + e.message);
        }
    }

    async function loadCourses() {
        tbodyCourses.innerHTML = `<tr><td colspan="6" style="text-align:center;"><div class="loading-spinner"></div></td></tr>`;
        try {
            const response = await fetch(`${backendUrl}/api/cursos/get.php`);
            if (!response.ok) throw new Error("No se encontraron cursos.");
            const data = await response.json();

            if (data.length === 0) {
                tbodyCourses.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-graduation-cap"></i><p>No hay cursos registrados.</p></td></tr>`;
                return;
            }

            tbodyCourses.innerHTML = data.map(course => `
                <tr>
                    <td>${course.id}</td>
                    <td style="font-weight: 600">${course.nombre}</td>
                    <td><span class="badge badge-purple">${course.categoria}</span></td>
                    <td style="font-size: 0.85rem">${course.descripcion || '-'}</td>
                    <td style="font-size: 0.8rem; color: var(--text-muted)">${course.temas || '-'}</td>
                    <td style="font-weight: 500">${course.docente_nombre || 'No asignado'}</td>
                </tr>
            `).join('');
        } catch (e) {
            tbodyCourses.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Error al cargar la lista de cursos.</p></td></tr>`;
        }
    }

    formCreateCourse.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            nombre: document.getElementById('course-name').value.trim(),
            categoria: document.getElementById('course-category').value.trim(),
            id_docente: document.getElementById('course-teacher').value,
            descripcion: document.getElementById('course-description').value.trim(),
            temas: document.getElementById('course-topics').value.trim()
        };

        try {
            const response = await fetch(`${backendUrl}/api/cursos/post.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const resData = await response.json();

            if (response.ok || response.status === 201) {
                showToast(resData.message || 'Curso registrado con éxito.', 'success');
                formCreateCourse.reset();
                loadCoursesData();
            } else {
                showToast(resData.message || 'No se pudo guardar el curso.', 'danger');
            }
        } catch (e) {
            showToast('Error de conexión al guardar el curso.', 'danger');
        }
    });

    formEnrollStudent.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            id_estudiante: document.getElementById('enroll-student-id').value,
            id_curso: document.getElementById('enroll-course-id').value,
            fecha_inicio: document.getElementById('enroll-start').value,
            fecha_fin: document.getElementById('enroll-end').value
        };

        try {
            const response = await fetch(`${backendUrl}/api/inscripciones/post.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const resData = await response.json();

            if (response.ok) {
                showToast(resData.message || 'Estudiante matriculado con éxito.', 'success');
                formEnrollStudent.reset();
            } else {
                showToast(resData.message || 'No se pudo realizar la inscripción.', 'danger');
            }
        } catch (e) {
            showToast('Error al enviar la matrícula.', 'danger');
        }
    });

    
    const formUploadMaterial = document.getElementById('form-upload-material');
    const tbodyMaterials = document.getElementById('tbody-materials');
    const uploadStatus = document.getElementById('material-upload-status');
    const btnSubmitMaterial = document.getElementById('btn-submit-material');

    async function loadMaterialsData() {
        await fillDropdowns();
        loadMaterials();
    }

    async function loadMaterials() {
        tbodyMaterials.innerHTML = `<tr><td colspan="7" style="text-align:center;"><div class="loading-spinner"></div></td></tr>`;
        try {
            // 1. Obtener materiales de la base de datos
            let dbMaterials = [];
            try {
                const resDb = await fetch(`${backendUrl}/api/materiales/get.php`);
                if (resDb.ok) dbMaterials = await resDb.json();
            } catch (e) {
                console.error("Error al obtener materiales de la DB:", e);
            }

            // 2. Obtener archivos reales de Google Drive
            let driveFiles = [];
            try {
                const resDrive = await fetch(`${backendUrl}/api/materiales/list_drive.php`);
                if (resDrive.ok) driveFiles = await resDrive.json();
            } catch (e) {
                console.error("Error al obtener archivos de Google Drive:", e);
            }

            if (driveFiles.length === 0 && dbMaterials.length === 0) {
                tbodyMaterials.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-folder-open"></i><p>No hay materiales didácticos registrados.</p></td></tr>`;
                return;
            }

            // Extractor de ID de archivo Drive auxiliar
            function getDriveFileId(url) {
                if (!url) return null;
                const m1 = url.match(/file\/d\/([a-zA-Z0-9-_]+)/);
                if (m1) return m1[1];
                const m2 = url.match(/id=([a-zA-Z0-9-_]+)/);
                if (m2) return m2[1];
                return null;
            }

            const renderedRows = [];
            const matchedDbIds = new Set();

            // Mapear los archivos que están en Google Drive
            driveFiles.forEach(file => {
                const dbMat = dbMaterials.find(m => getDriveFileId(m.url_archivo) === file.id);
                
                let id = '---';
                let curso = '<span class="badge" style="background: rgba(244,180,0,0.15); color: #f4b400; font-size: 0.75rem;"><i class="fa-brands fa-google-drive"></i> Solo en Drive</span>';
                let titulo = file.name;
                let tipo = 'Drive';
                let fecha = '---';
                let deleteBtn = `<button class="btn btn-secondary btn-sm delete-drive-file-btn" data-drive-id="${file.id}">
                                    <i class="fa-solid fa-trash-can" style="color:var(--danger-color)"></i>
                                 </button>`;

                if (dbMat) {
                    matchedDbIds.add(dbMat.id);
                    id = dbMat.id;
                    curso = dbMat.curso_nombre || 'N/A';
                    titulo = dbMat.titulo;
                    tipo = dbMat.tipo;
                    fecha = dbMat.fecha_publicacion;
                    deleteBtn = `<button class="btn btn-secondary btn-sm delete-material-btn" data-id="${dbMat.id}">
                                    <i class="fa-solid fa-trash-can" style="color:var(--danger-color)"></i>
                                 </button>`;
                }

                const esTraducido = titulo.includes('(Traducido al Español)');
                const isPdf = (tipo === 'PDF' || file.mimeType === 'application/pdf');

                renderedRows.push(`
                    <tr style="${esTraducido ? 'background: rgba(16, 185, 129, 0.04);' : ''}">
                        <td>${id}</td>
                        <td style="font-weight: 500">${curso}</td>
                        <td>
                            <div style="display:flex; align-items:center; gap: 0.5rem;">
                                ${esTraducido ? '<i class="fa-solid fa-language" style="color:var(--success-color);" title="Traducido automáticamente"></i>' : '<i class="fa-solid fa-file-lines" style="color:var(--text-muted);"></i>'}
                                <span style="font-weight: ${esTraducido ? '600' : '400'}">${titulo}</span>
                            </div>
                        </td>
                        <td><span class="badge ${isPdf ? 'badge-blue' : 'badge-green'}">${tipo}</span></td>
                        <td style="font-size: 0.85rem; color: var(--text-muted)">${fecha}</td>
                        <td>
                            <div class="btn-group">
                                <a href="${file.webViewLink}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none;">
                                    <i class="fa-solid fa-eye"></i> Ver en Drive
                                </a>
                            </div>
                        </td>
                        <td>
                            ${deleteBtn}
                        </td>
                    </tr>
                `);
            });

            // Mostrar también registros huérfanos de la DB (que no se encontraron en Drive)
            dbMaterials.forEach(dbMat => {
                if (matchedDbIds.has(dbMat.id)) return;

                const esTraducido = dbMat.titulo.includes('(Traducido al Español)');

                renderedRows.push(`
                    <tr style="opacity: 0.65; background: rgba(234, 67, 53, 0.02);">
                        <td>${dbMat.id}</td>
                        <td style="font-weight: 500">${dbMat.curso_nombre || 'N/A'}</td>
                        <td>
                            <div style="display:flex; align-items:center; gap: 0.5rem;">
                                <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger-color);" title="Archivo no encontrado en Google Drive"></i>
                                <span style="text-decoration: line-through;">${dbMat.titulo}</span>
                            </div>
                        </td>
                        <td><span class="badge ${dbMat.tipo === 'PDF' ? 'badge-blue' : 'badge-green'}">${dbMat.tipo}</span></td>
                        <td style="font-size: 0.85rem; color: var(--text-muted)">${dbMat.fecha_publicacion}</td>
                        <td>
                            <span style="color: var(--danger-color); font-size: 0.85rem;"><i class="fa-solid fa-circle-xmark"></i> No en Drive</span>
                        </td>
                        <td>
                            <button class="btn btn-secondary btn-sm delete-material-btn" data-id="${dbMat.id}">
                                <i class="fa-solid fa-trash-can" style="color:var(--danger-color)"></i>
                            </button>
                        </td>
                    </tr>
                `);
            });

            tbodyMaterials.innerHTML = renderedRows.join('');

            // Event Listeners para botones de eliminación
            document.querySelectorAll('.delete-material-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    if (confirm('¿Estás seguro de eliminar este material?')) {
                        deleteMaterial(id);
                    }
                });
            });

            document.querySelectorAll('.delete-drive-file-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const driveId = btn.getAttribute('data-drive-id');
                    if (confirm('Este archivo existe en Google Drive pero no está registrado en la base de datos. ¿Estás seguro de eliminarlo permanentemente de Google Drive?')) {
                        deleteDriveFileOnly(driveId);
                    }
                });
            });

        } catch (e) {
            console.error("Error cargando tabla de materiales:", e);
            tbodyMaterials.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Error al cargar los materiales de estudio.</p></td></tr>`;
        }
    }

    async function deleteMaterial(id) {
        try {
            const response = await fetch(`${backendUrl}/api/materiales/delete.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
            const resData = await response.json();
            if (response.ok) {
                showToast(resData.message || 'Material eliminado.', 'success');
                loadMaterials();
            } else {
                showToast(resData.message || 'Error al eliminar material.', 'danger');
            }
        } catch (e) {
            showToast('Error de red al intentar eliminar el material.', 'danger');
        }
    }

    async function deleteDriveFileOnly(driveId) {
        try {
            const response = await fetch(`${backendUrl}/api/materiales/delete_drive_file.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ drive_id: driveId })
            });
            const resData = await response.json();
            if (response.ok) {
                showToast(resData.message || 'Archivo eliminado de Drive.', 'success');
                loadMaterials();
            } else {
                showToast(resData.message || 'Error al eliminar archivo de Drive.', 'danger');
            }
        } catch (e) {
            showToast('Error de red al intentar eliminar el archivo de Drive.', 'danger');
        }
    }

    formUploadMaterial.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('material-file');
        if (fileInput.files.length === 0) {
            showToast('Por favor, selecciona un archivo.', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('id_curso', document.getElementById('material-course').value);
        formData.append('titulo', document.getElementById('material-title').value.trim());
        formData.append('tipo', document.getElementById('material-type').value);
        formData.append('archivo', fileInput.files[0]);

        
        uploadStatus.style.display = 'inline-flex';
        btnSubmitMaterial.disabled = true;

        try {
            const response = await fetch(`${backendUrl}/api/materiales/post.php`, {
                method: 'POST',
                body: formData 
            });
            const resData = await response.json();

            if (response.status === 201 || response.ok) {
                showToast('Material subido. Si era en inglés, se generó y subió una traducción en español automáticamente.', 'success');
                formUploadMaterial.reset();
                loadMaterials();
            } else {
                showToast(resData.message || 'Ocurrió un error al subir el material.', 'danger');
            }
        } catch (e) {
            showToast('Error de conexión con el servidor al subir el archivo.', 'danger');
        } finally {
            uploadStatus.style.display = 'none';
            btnSubmitMaterial.disabled = false;
        }
    });

    
    const selectFilterType = document.getElementById('filter-type');
    const inputFilterValue = document.getElementById('filter-value');
    const selectFilterValue = document.getElementById('filter-value-select');
    const filterValueGroup = document.getElementById('filter-value-group');
    const btnApplyFilter = document.getElementById('btn-apply-filter');
    const tbodyAttendance = document.getElementById('tbody-attendance');

    // Manejador del cambio de tipo de filtro para adaptar el campo de valor
    selectFilterType.addEventListener('change', () => {
        const type = selectFilterType.value;
        inputFilterValue.value = '';
        selectFilterValue.innerHTML = '';
        
        if (type === 'all') {
            filterValueGroup.style.opacity = '0.3';
            inputFilterValue.disabled = true;
            inputFilterValue.style.display = 'block';
            selectFilterValue.style.display = 'none';
            inputFilterValue.placeholder = 'No se necesita valor';
        } else if (type === 'user') {
            filterValueGroup.style.opacity = '1';
            inputFilterValue.disabled = false;
            inputFilterValue.style.display = 'block';
            selectFilterValue.style.display = 'none';
            inputFilterValue.placeholder = 'Ej: ID del Estudiante (1, 2...)';
        } else if (type === 'sede') {
            filterValueGroup.style.opacity = '1';
            inputFilterValue.style.display = 'none';
            selectFilterValue.style.display = 'block';
            selectFilterValue.innerHTML = `
                <option value="San Miguel">San Miguel</option>
                <option value="Monterrico">Monterrico</option>
                <option value="San Isidro">San Isidro</option>
            `;
        } else if (type === 'state') {
            filterValueGroup.style.opacity = '1';
            inputFilterValue.style.display = 'none';
            selectFilterValue.style.display = 'block';
            selectFilterValue.innerHTML = `
                <option value="Presente">Presente</option>
                <option value="Tardanza">Tardanza</option>
                <option value="Falta">Falta</option>
            `;
        }
    });
    
    selectFilterType.dispatchEvent(new Event('change'));

    btnApplyFilter.addEventListener('click', () => {
        const type = selectFilterType.value;
        const val = (type === 'sede' || type === 'state') ? selectFilterValue.value : inputFilterValue.value.trim();
        loadAttendances(type, val);
    });

    async function loadAttendances(filterType, filterValue = '') {
        tbodyAttendance.innerHTML = `<tr><td colspan="6" style="text-align:center;"><div class="loading-spinner"></div></td></tr>`;
        
        let endpoint = `${backendUrl}/api/asistencias/get.php`;
        if (filterType === 'user' && filterValue) {
            endpoint = `${backendUrl}/api/asistencias/getByUserId.php?id_usuario=${encodeURIComponent(filterValue)}`;
        } else if (filterType === 'sede' && filterValue) {
            endpoint = `${backendUrl}/api/asistencias/getBySede.php?sede=${encodeURIComponent(filterValue)}`;
        } else if (filterType === 'state' && filterValue) {
            endpoint = `${backendUrl}/api/asistencias/getByState.php?estado=${encodeURIComponent(filterValue)}`;
        }

        try {
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error("Sin registros");
            const data = await response.json();

            const records = Array.isArray(data) ? data : [data]; 

            if (records.length === 0 || !records[0] || records[0].message) {
                tbodyAttendance.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-id-card-clip"></i><p>No se encontraron registros de asistencias para este filtro.</p></td></tr>`;
                return;
            }

            tbodyAttendance.innerHTML = records.map(att => `
                <tr>
                    <td><code>#${att.id}</code></td>
                    <td style="font-weight: 500">${att.usuario_nombre || `Usuario ID: ${att.id_usuario}`}</td>
                    <td style="font-size: 0.85rem">${att.fecha_hora}</td>
                    <td><span class="badge badge-blue">${att.sede}</span></td>
                    <td style="font-size: 0.8rem; color:var(--text-muted)"><code>${att.dispositivo_rfid}</code></td>
                    <td>
                        <span class="badge ${att.estado === 'Presente' ? 'badge-green' : att.estado === 'Tardanza' ? 'badge-orange' : 'badge-red'}">
                            ${att.estado}
                        </span>
                    </td>
                </tr>
            `).join('');

        } catch (e) {
            tbodyAttendance.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>No se encontraron datos de asistencias bajo este filtro.</p></td></tr>`;
        }
    }

    
    const formPerformance = document.getElementById('form-performance');
    const tbodyPerformance = document.getElementById('tbody-performance');

    async function loadPerformanceData() {
        await fillDropdowns();
        loadPerformance();
    }

    async function loadPerformance() {
        tbodyPerformance.innerHTML = `<tr><td colspan="5" style="text-align:center;"><div class="loading-spinner"></div></td></tr>`;
        try {
            const response = await fetch(`${backendUrl}/api/rendimiento/get.php`);
            if (!response.ok) throw new Error("Sin datos de rendimiento");
            const data = await response.json();

            if (data.length === 0) {
                tbodyPerformance.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-chart-line"></i><p>No hay reportes de rendimiento escolar registrados.</p></td></tr>`;
                return;
            }

            tbodyPerformance.innerHTML = data.map(perf => {
                const score = parseFloat(perf.nota_final);
                let scoreClass = 'badge-green';
                if (score < 10.5) scoreClass = 'badge-red';
                else if (score < 14) scoreClass = 'badge-orange';

                return `
                    <tr>
                        <td style="font-weight: 500">${perf.estudiante_nombre || `Estudiante ID: ${perf.id_estudiante}`}</td>
                        <td style="font-weight: 500">${perf.curso_nombre || `Curso ID: ${perf.id_curso}`}</td>
                        <td style="text-align:center"><span class="badge badge-blue">${perf.total_asistencias}</span></td>
                        <td style="text-align:center"><span class="badge badge-purple">${perf.total_faltas}</span></td>
                        <td><span class="badge ${scoreClass}" style="font-size: 0.85rem">${score.toFixed(1)}</span></td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            tbodyPerformance.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Error al cargar el consolidado escolar.</p></td></tr>`;
        }
    }

    formPerformance.addEventListener('submit', async (e) => {
        const payload = {
            id_estudiante: document.getElementById('perf-student').value,
            id_curso: document.getElementById('perf-course').value,
            total_asistencias: parseInt(document.getElementById('perf-attendances').value),
            total_faltas: parseInt(document.getElementById('perf-absences').value),
            nota_final: parseFloat(document.getElementById('perf-score').value)
        };

        try {
            const response = await fetch(`${backendUrl}/api/rendimiento/post.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const resData = await response.json();

            if (response.ok) {
                showToast(resData.message || 'Reporte de rendimiento registrado con éxito.', 'success');
                formPerformance.reset();
                loadPerformance();
            } else {
                showToast(resData.message || 'No se pudo guardar el reporte.', 'danger');
            }
        } catch (e) {
            showToast('Error de red al enviar reporte de rendimiento.', 'danger');
        }
    });

    
    const qrModalOverlay = document.getElementById('qr-modal-overlay');
    const btnCloseQrModal = document.getElementById('btn-close-qr-modal');
    const btnCloseQrModalFooter = document.getElementById('btn-close-qr-modal-footer');
    const qrCredentialImage = document.getElementById('qr-credential-image');
    const qrModalName = document.getElementById('qr-modal-name');
    const qrModalCode = document.getElementById('qr-modal-code');

    function openQrModal(id, codigo, nombre) {
        
        const qrData = `EDUBRIDGE_QR:${id}`;
        qrCredentialImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
        qrModalName.textContent = nombre;
        qrModalCode.textContent = codigo;
        qrModalOverlay.classList.add('active');
    }

    btnCloseQrModal.addEventListener('click', () => qrModalOverlay.classList.remove('active'));
    btnCloseQrModalFooter.addEventListener('click', () => qrModalOverlay.classList.remove('active'));

    
    const btnToggleScanner = document.getElementById('btn-toggle-scanner');
    const doorSedeSelect = document.getElementById('door-sede');
    const doorPanel = document.getElementById('door-panel');
    const doorBg = document.getElementById('door-bg');
    const welcomeBadge = document.getElementById('welcome-badge');
    const welcomeBadgeText = document.getElementById('welcome-badge-text');
    const doorLockIcon = document.getElementById('door-lock-icon');
    const doorStatusTitle = document.getElementById('door-status-title');
    const doorStatusDesc = document.getElementById('door-status-desc');
    const tbodyQrAccess = document.getElementById('tbody-qr-access');

    let html5QrCode = null;
    let isScannerActive = false;
    let recentAccesses = [];

    btnToggleScanner.addEventListener('click', () => {
        if (isScannerActive) {
            stopScanner();
        } else {
            startScanner();
        }
    });

    function startScanner() {
        if (isScannerActive) return;
        
        html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 220, height: 220 } };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            onQrScanSuccess,
            onQrScanFailure
        ).then(() => {
            isScannerActive = true;
            btnToggleScanner.innerHTML = `<i class="fa-solid fa-stop"></i> Detener Escáner`;
            btnToggleScanner.classList.replace('btn-primary', 'btn-secondary');
            showToast('Cámara web iniciada. Muestra un código QR en la lente.', 'success');
        }).catch(err => {
            console.error("Error al iniciar cámara: ", err);
            showToast('No se pudo acceder a la cámara web. Asegúrate de dar permisos.', 'danger');
        });
    }

    function stopScanner() {
        if (!isScannerActive || !html5QrCode) return;
        
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            html5QrCode = null;
            isScannerActive = false;
            btnToggleScanner.innerHTML = `<i class="fa-solid fa-camera"></i> Iniciar Escáner`;
            btnToggleScanner.classList.replace('btn-secondary', 'btn-primary');
            showToast('Escáner de cámara detenido.', 'warning');
        }).catch(err => {
            console.error("Error al detener cámara: ", err);
        });
    }

    let isProcessingScan = false;
    async function onQrScanSuccess(decodedText, decodedResult) {
        if (isProcessingScan) return;
        isProcessingScan = true;
        
        
        setTimeout(() => { isProcessingScan = false; }, 4000);

        if (!decodedText.startsWith("EDUBRIDGE_QR:")) {
            triggerDoorState('denied', 'QR INVÁLIDO', 'Formato de credencial no reconocido.');
            addAccessLog(new Date().toLocaleTimeString(), 'Desconocido', 'QR Inválido', 'Denegado');
            return;
        }

        const id = decodedText.split(':')[1];
        const sede = doorSedeSelect.value;

        try {
            
            const userResponse = await fetch(`${backendUrl}/api/usuarios/getById.php?id=${id}`);
            if (!userResponse.ok) {
                triggerDoorState('denied', 'ACCESO DENEGADO', 'Usuario no registrado en la base de datos.');
                addAccessLog(new Date().toLocaleTimeString(), `ID Usuario: ${id}`, 'No encontrado', 'Denegado');
                return;
            }

            const user = await userResponse.json();

            
            const payload = {
                id_usuario: user.id,
                sede: sede,
                estado: 'Presente',
                dispositivo_rfid: 'LECTOR-QR-PUERTA'
            };

            const attResponse = await fetch(`${backendUrl}/api/asistencias/post.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const attData = await attResponse.json();

            if (attResponse.status === 201 || attResponse.ok) {
                triggerDoorState('granted', 'ACCESO CONCEDIDO', `¡Bienvenido/a, ${user.nombre_completo}!`);
                addAccessLog(new Date().toLocaleTimeString(), user.nombre_completo, user.codigo, 'Concedido', sede);
                updateCounters();
            } else {
                triggerDoorState('denied', 'DENEGADO', attData.message || 'Error al guardar la asistencia.');
                addAccessLog(new Date().toLocaleTimeString(), user.nombre_completo, user.codigo, 'Fallo Registro');
            }

        } catch (error) {
            console.error(error);
            triggerDoorState('denied', 'FALLO CONEXIÓN', 'No se pudo conectar con el servidor backend.');
        }
    }

    function onQrScanFailure(error) {
        
    }

    let doorTimer = null;
    function triggerDoorState(state, title, description) {
        if (doorTimer) clearTimeout(doorTimer);

        // Reset classes and icons
        doorPanel.classList.remove('door-opened', 'door-shaking');
        doorBg.classList.remove('denied-bg');
        welcomeBadge.classList.remove('active', 'denied-badge');
        const badgeIcon = welcomeBadge.querySelector('i');
        badgeIcon.className = "fa-solid fa-circle-check";

        if (state === 'granted') {
            // Open door panel and show green badge
            doorPanel.classList.add('door-opened');
            welcomeBadgeText.textContent = "PRESENTE";
            welcomeBadge.classList.add('active');
            
            doorLockIcon.className = "fa-solid fa-lock-open";
            doorStatusTitle.innerHTML = `<span style="color: var(--success-color)">${title}</span>`;
            doorStatusDesc.textContent = description;
        } else {
            // Shake door closed and show red badge behind it
            void doorPanel.offsetWidth; // Trigger reflow to restart animation
            doorPanel.classList.add('door-shaking');
            
            doorBg.classList.add('denied-bg');
            badgeIcon.className = "fa-solid fa-circle-xmark";
            welcomeBadgeText.textContent = "DENEGADO";
            welcomeBadge.classList.add('denied-badge', 'active');
            
            doorLockIcon.className = "fa-solid fa-lock";
            doorStatusTitle.innerHTML = `<span style="color: var(--danger-color)">${title}</span>`;
            doorStatusDesc.textContent = description;
        }

        // Auto close and lock after 4 seconds
        doorTimer = setTimeout(() => {
            doorPanel.classList.remove('door-opened', 'door-shaking');
            doorBg.classList.remove('denied-bg');
            welcomeBadge.classList.remove('active', 'denied-badge');
            badgeIcon.className = "fa-solid fa-circle-check";
            welcomeBadgeText.textContent = "PRESENTE";
            
            doorLockIcon.className = "fa-solid fa-lock";
            doorStatusTitle.textContent = "PUERTA CERRADA";
            doorStatusDesc.textContent = "Muestra tu código QR al lector para ingresar.";
        }, 4000);
    }

    function addAccessLog(hora, nombre, codigo, resultado, sede = '') {
        recentAccesses.unshift({
            hora: hora,
            nombre: nombre,
            codigo: codigo,
            resultado: resultado,
            sede: sede || doorSedeSelect.value
        });

        if (recentAccesses.length > 8) {
            recentAccesses.pop();
        }

        tbodyQrAccess.innerHTML = recentAccesses.map(log => `
            <tr>
                <td><code>${log.hora}</code></td>
                <td style="font-weight: 500">${log.nombre}</td>
                <td><code style="color:var(--primary-color)">${log.codigo}</code></td>
                <td><span class="badge badge-blue">${log.sede}</span></td>
                <td>
                    <span class="badge ${log.resultado === 'Concedido' ? 'badge-green' : 'badge-red'}">
                        ${log.resultado}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    // Carga la lista de estudiantes para el simulador RFID
    async function loadRfidSimStudents() {
        const selectSimStudent = document.getElementById('rfid-sim-student');
        if (!selectSimStudent) return;
        selectSimStudent.innerHTML = `<option value="">Cargando estudiantes...</option>`;
        try {
            const response = await fetch(`${backendUrl}/api/usuarios/get.php`);
            if (!response.ok) throw new Error();
            const users = await response.json();
            const students = Array.isArray(users) ? users.filter(u => u.tipo === 'Estudiante') : [];
            
            if (students.length === 0) {
                selectSimStudent.innerHTML = `<option value="">No hay estudiantes registrados</option>`;
                return;
            }
            
            selectSimStudent.innerHTML = students.map(s => `
                <option value="${s.id}">${s.nombre_completo} (${s.codigo})</option>
            `).join('');
        } catch (e) {
            selectSimStudent.innerHTML = `<option value="">Error al cargar estudiantes</option>`;
        }
    }

    // Lógica del Simulador de RFID
    const formRfidSimulate = document.getElementById('form-rfid-simulate');
    
    if (formRfidSimulate) {
        formRfidSimulate.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btnSubmit = document.getElementById('btn-submit-rfid');
            const studentId = document.getElementById('rfid-sim-student').value;
            const sede = document.getElementById('rfid-sim-sede').value;
            const estado = document.getElementById('rfid-sim-state').value;
            const deviceId = document.getElementById('rfid-sim-device').value.trim();
            
            if (!studentId) {
                showToast('Selecciona un estudiante válido.', 'warning');
                return;
            }
            
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<div class="loading-spinner" style="width:14px; height:14px; border-width:2px; display:inline-block; margin-right:5px;"></div> Registrando...`;
            
            const payload = {
                id_usuario: parseInt(studentId),
                sede: sede,
                estado: estado,
                dispositivo_rfid: deviceId || 'RFID-LECTOR-WEB-SIM'
            };
            
            try {
                const response = await fetch(`${backendUrl}/api/asistencias/post.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const resData = await response.json();
                
                if (response.ok || response.status === 201) {
                    showToast('Asistencia RFID simulada y guardada correctamente.', 'success');
                    loadAttendances('all'); // Recarga el historial de asistencias
                    updateCounters(); // Actualiza los contadores del Dashboard
                } else {
                    showToast(resData.message || 'Error al guardar la asistencia simulada.', 'danger');
                }
            } catch (error) {
                console.error(error);
                showToast('Error de red al conectar con el servidor backend.', 'danger');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<i class="fa-solid fa-id-card"></i> Simular Lectura de Tarjeta`;
            }
        });
    }

    
    updateCounters();
});
