import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import { useProducts } from './useProducts';
import './App.css';

const Navigation = ({ view, setView }) => (
    <nav className="navbar">
        <div className="nav-logo" onClick={() => setView('home')} style={{ cursor: 'pointer' }}>🍰 SweetOrders</div>
        <div className="nav-links">
            <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>Home</button>
            <button className={view === 'products' ? 'active' : ''} onClick={() => setView('products')}>Products</button>
        </div>
    </nav>
);

const HomePage = ({ setView }) => (
    <div className="home-container fade-in">
        <div className="hero-section">
            <div className="simple-logo">🍭</div>
            <h1>SweetOrders</h1>
            <p className="hero-desc">Baking Life Sweeter, One Order at a Time!</p>
            <button className="btn-primary" onClick={() => setView('products')}>Vezi Catalogul</button>
        </div>
    </div>
);

const StatusBar = ({ isOnline, isSyncing, wsConnected, offlinePending }) => (
    <div className={`status-bar ${isOnline ? 'online' : 'offline'}`}>
        <span>{isOnline ? '🟢 Online' : '🔴 Offline'}</span>
        <span>{wsConnected ? '⚡ WebSocket activ' : '⚠️ WebSocket deconectat'}</span>
        {isSyncing && <span>🔄 Sincronizare...</span>}
        {!isOnline && offlinePending > 0 && <span>📦 {offlinePending} operații în așteptare</span>}
    </div>
);


const ProductDetailPanel = ({ product, onUpdate, onClose }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState(null);
    const [errors, setErrors] = useState([]);

    useEffect(() => {
        if (product) {
            setForm({
                name: product.name || "",
                price: product.price || 0,
                description: product.description || "",
                image: product.image || "",
                categoryId: product.categoryId || 1
            });
            setIsEditing(false);
        }
    }, [product?.id]);

    if (!product || !form) return null;

    const handleSave = async () => {
        if (!form.description || form.description.trim().length < 5) {
            setErrors(['Descrierea este obligatorie (minim 5 caractere).']);
            return;
        }

        const dataToSend = {
            name: form.name,
            price: Number(form.price),
            description: form.description,
            image: form.image,
            categoryId: Number(form.categoryId)
        };

        const result = await onUpdate(product.id, dataToSend);

        if (result.success) {
            setIsEditing(false);
            setErrors([]);
        } else {
            setErrors(result.errors || ['Eroare: Serverul a respins datele. Verifică toate câmpurile.']);
        }
    };

    return (
        <div className="detail-panel card fade-in">
            <div className="panel-header">
                <h3>Detalii Produs</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>

            <img
                src={product.image || `https://loremflickr.com/150/150/bakery?lock=${product.id}`}
                className="detail-img"
                alt=""
                onError={e => e.target.src = "https://via.placeholder.com/400"}
            />

            <div className="panel-body">
                {errors.length > 0 && (
                    <div className="error-list">
                        {errors.map((e, i) => <p key={i} className="error-msg">⚠️ {e}</p>)}
                    </div>
                )}

                {isEditing ? (
                    <div className="edit-fields">
                        <label>Nume:</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

                        <label>Preț:</label>
                        <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />

                        <label>Categorie (Selectează din listă):</label>
                        <select
                            value={form.categoryId}
                            onChange={e => setForm({ ...form, categoryId: e.target.value })}
                            className="edit-select"
                        >
                            <option value="1">Dulciuri</option>
                            <option value="2">Patiserie</option>
                            <option value="3">Băuturi</option>
                            <option value="4">Torturi</option>
                        </select>

                        <label>URL Imagine:</label>
                        <input value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} />

                        <label>Descriere:</label>
                        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

                        <button className="btn-save" onClick={handleSave}>Salvează Modificările</button>
                        <button className="btn-cancel" onClick={() => setIsEditing(false)}>Anulează</button>
                    </div>
                ) : (
                    <>
                        <h4>{product.name}</h4>
                        <p className="price-text">Preț: ${Number(product.price).toFixed(2)}</p>
                            <p>
                                <strong>Categorie curentă:</strong> {
                                    product.categoryId == 1 ? 'Dulciuri' :
                                        product.categoryId == 2 ? 'Patiserie' :
                                            product.categoryId == 3 ? 'Băuturi' :
                                                product.categoryId == 4 ? 'Torturi' : 'Nesetată'
                                }
                            </p>
                        <p className="desc-text">{product.description}</p>
                        <button className="btn-edit" onClick={() => setIsEditing(true)}>✎ Editare</button>
                    </>
                )}
            </div>
        </div>
    );
};

const ProductPage = ({
    products, totalPages, currentPage, fetchProducts,
    selectedProduct, setSelectedProduct,
    handleDelete, handleAdd, handleUpdate,
    cookies, startFaker, stopFaker,
}) => {
    const [addErrors, setAddErrors] = useState([]);

    const onAddSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const productData = {
            name: formData.get('pName'),
            price: Number(formData.get('pPrice')),
            categoryId: formData.get('pCategory'),
            description: formData.get('pDesc'),
            image: formData.get('pImage') || '',
        };
        const result = await handleAdd(productData);
        if (result.success) {
            setAddErrors([]);
            e.target.reset();
        } else {
            setAddErrors(result.errors || ['Eroare necunoscută.']);
        }
    };
    const [activeFilter, setActiveFilter] = useState('');

    const handleFilterChange = (e) => {
        const selectedCategory = e.target.value;
        setActiveFilter(selectedCategory); 
        fetchProducts(1, selectedCategory); 
    };

    return (
        <div className="fade-in">
            <header className="page-header">
                <h2>Product Management</h2>
                {cookies.lastActivity && <small className="activity-tag">Ultima activitate: {cookies.lastActivity}</small>}
            </header>

            <div className="faker-controls card">
                <h4>🤖 Generator Automat </h4>
                <button className="btn-faker-start" onClick={startFaker}>▶ Start Generator</button>
                <button className="btn-faker-stop" onClick={stopFaker}>⏹ Stop Generator</button>
            </div>

            <div className="filter-controls card" style={{ padding: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>🔍 Filtrează după Categorie:</span>
                <select
                    value={activeFilter} 
                    onChange={handleFilterChange} 
                    className="filter-select"
                    style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }}
                >
                    <option value="">Toate Produsele</option>
                    <option value="1">Dulciuri</option>
                    <option value="2">Patiserie</option>
                    <option value="3">Băuturi</option>
                    <option value="4">Torturi</option>
                </select>
            </div>

            <div className="main-content">
                <div className="master-view card">
                    <table className="product-table">
                        <thead>
                            <tr><th>Imagine</th><th>Name</th><th>Price</th><th>Description</th></tr>
                        </thead>
                         <tbody>
                            {Array.isArray(products) && products.length > 0 ? (
                                products.map(p => (
                                    <tr key={p.id} className={p._offline ? 'row-offline' : ''}>
                                        <td>
                                            <img
                                                src={p.image || `https://loremflickr.com/150/150/bakery?lock=${p.id}`}
                                                className="thumb"
                                                alt={p.name}
                                                onError={e => e.target.src = "https://via.placeholder.com/150"}
                                            />
                                        </td>
                                        <td><strong>{p.name}</strong> {p._offline && '📵'}</td>
                                        <td>${p.price ? Number(p.price).toFixed(2) : '0.00'}</td>
                                        <td>
                                            <button onClick={() => setSelectedProduct(p)}>Detalii</button>
                                            <button onClick={() => handleDelete(p.id)} className="btn-del">🗑️</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="4">Se încarcă produsele...</td></tr>
                            )}
                        </tbody>
                    </table>

                    <div className="pagination">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => fetchProducts(currentPage - 1, activeFilter)}
                        >
                            « Prev
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                className={currentPage === page ? 'active' : ''}
                                onClick={() => fetchProducts(page, activeFilter)}
                            >
                                {page}
                            </button>
                        ))}

                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => fetchProducts(currentPage + 1, activeFilter)}
                        >
                            Next »
                        </button>
                    </div>
                </div> {/* <--- ACEASTA ERA ACOLADA LIPSĂ care închide 'master-view' */}

                {selectedProduct && (
                    <ProductDetailPanel
                        product={selectedProduct}
                        onUpdate={handleUpdate}
                        onClose={() => setSelectedProduct(null)}
                    />
                )}
            </div>

            <div className="add-section card">
                <h3>Adaugă Produs Nou</h3>
                {addErrors.length > 0 && (
                    <div className="error-list">
                        {addErrors.map((e, i) => <p key={i} className="error-msg">⚠️ {e}</p>)}
                    </div>
                )}
                <form onSubmit={onAddSubmit} className="form-inline">
                    <input name="pName" placeholder="Nume" required />
                    <input name="pPrice" type="number" step="0.01" placeholder="Preț" required />
                    <select name="pCategory" required>
                        <option value="">Selectează Categorie</option>
                        <option value="1">Dulciuri</option>
                        <option value="2">Patiserie</option>
                        <option value="3">Bauturi</option>
                        <option value="4">Torturi</option>
                    </select>
                    <input name="pImage" placeholder="URL Imagine" />
                    <textarea name="pDesc" placeholder="Descriere" required />
                    <button type="submit" className="btn-add">Adaugă</button>
                </form>
            </div>
        </div>
    );
};

const App = () => {
    const [view, setView] = useState('home');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [cookies, setCookie] = useCookies(['lastActivity']);

    const {
        products, totalPages, currentPage,
        isOnline, isSyncing, wsConnected, offlinePending,
        fetchProducts, addProduct, updateProduct, deleteProduct,
        startFaker, stopFaker,
    } = useProducts();

    const updateActivityLog = (action) => {
        setCookie('lastActivity', `${action} la ${new Date().toLocaleTimeString()}`, { path: '/' });
    };

    const handleAdd = async (data) => {
        const result = await addProduct(data);
        if (result.success) updateActivityLog(`Adăugare: ${data.name}`);
        return result;
    };

    const handleUpdate = async (id, data) => {
        const result = await updateProduct(id, data);
        if (result.success) {
            updateActivityLog(`Update: ${data.name}`);
            setSelectedProduct(prev => ({ ...prev, ...data }));
        }
        return result; 
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Ștergi acest produs?')) return;
        const result = await deleteProduct(id);
        if (result.success) {
            updateActivityLog(`Ștergere ID: ${id}`);
            if (selectedProduct?.id === id) setSelectedProduct(null);
        }
    };

    return (
        <div className="app-wrapper">
            <Navigation view={view} setView={setView} />
            <StatusBar isOnline={isOnline} isSyncing={isSyncing} wsConnected={wsConnected} offlinePending={offlinePending} />
            <main className="content-area">
                {view === 'home' ? (
                    <HomePage setView={setView} />
                ) : (
                    <ProductPage
                        products={products}
                        totalPages={totalPages}
                        currentPage={currentPage}
                        fetchProducts={fetchProducts}
                        selectedProduct={selectedProduct}
                        setSelectedProduct={setSelectedProduct}
                        handleDelete={handleDelete}
                        handleAdd={handleAdd}
                        handleUpdate={handleUpdate}
                        cookies={cookies}
                        startFaker={startFaker}
                        stopFaker={stopFaker}
                    />
                )}
            </main>
        </div>
    );
};

export default App;