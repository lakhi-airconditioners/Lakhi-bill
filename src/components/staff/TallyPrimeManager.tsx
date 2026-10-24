import React, { useState } from 'react';
import {
  parseTallyXml,
  generateTallySalesXml,
  DecodedTallyData,
  DecodedTallyLedger,
  DecodedTallyVoucher
} from '../../utils/tallyHelper';

export const TallyPrimeManager: React.FC = () => {
  const [data, setData] = useState<DecodedTallyData | null>(null);
  const [activeTab, setActiveTab] = useState<'ledgers' | 'vouchers' | 'units'>('ledgers');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // File Upload and Parsing Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const xmlText = event.target?.result as string;
        const parsed = parseTallyXml(xmlText);
        setData(parsed);
      } catch (err) {
        console.error('Failed to parse Tally XML:', err);
        alert('Could not parse the selected file. Please ensure it is a valid Tally XML export.');
      }
    };
    reader.readAsText(file);
  };

  // Trigger download of XML file
  const downloadXml = (xmlContent: string, filename: string) => {
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export Sample Sales Invoice
  const handleExportSampleInvoice = () => {
    setIsExporting(true);
    const xml = generateTallySalesXml({
      companyName: data?.companyName || 'LAKHI ELECTRONICS AIRCONDITIONERS',
      voucherNumber: 'INV/2026/001',
      date: '20261025',
      partyName: data?.ledgers[0]?.name || 'Metro Cooling Center',
      isDeliveryChallan: false,
      items: [
        {
          name: '1.5 Ton Split AC 5 Star',
          qty: 1,
          unit: 'SET',
          rate: 35000,
          godown: 'Central Warehouse',
          serialNo: 'SN-2026-VOL-9921'
        }
      ],
      taxRatePercent: 18,
      isInterstate: false
    });

    downloadXml(xml, 'Tally_Sales_Invoice_Sample.xml');
    setIsExporting(false);
  };

  // Export Sample Delivery Challan (Only Stock Allocation, No Accounting)
  const handleExportDeliveryChallan = () => {
    setIsExporting(true);
    const xml = generateTallySalesXml({
      companyName: data?.companyName || 'LAKHI ELECTRONICS AIRCONDITIONERS',
      voucherNumber: 'DC/2026/001',
      date: '20261025',
      partyName: data?.ledgers[0]?.name || 'Metro Cooling Center',
      isDeliveryChallan: true,
      items: [
        {
          name: '1.5 Ton Split AC 5 Star',
          qty: 2,
          unit: 'SET',
          rate: 35000,
          godown: 'Main Showroom',
          serialNo: 'SN-2026-DC-01'
        }
      ]
    });

    downloadXml(xml, 'Tally_Delivery_Challan_Sample.xml');
    setIsExporting(false);
  };

  // Filtered lists for UI
  const filteredLedgers = data?.ledgers.filter((l) =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.gstin.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.parent.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredVouchers = data?.vouchers.filter((v) =>
    v.voucherNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.voucherType.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Top Banner / Upload Zone */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tally Prime XML Integration</h2>
          <p className="text-sm text-gray-500">
            Import master files, inspect party ledger balances, and generate Tally-compatible XML exports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm">
            Import Tally XML
            <input
              type="file"
              accept=".xml"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Company</span>
            <p className="text-base font-bold text-gray-800 truncate mt-1">
              {data.companyName || 'Not Defined'}
            </p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Ledgers</span>
            <p className="text-2xl font-bold text-blue-600 mt-1">{data.ledgers.length}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Vouchers</span>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{data.vouchers.length}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Units of Measure</span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{data.units.length}</p>
          </div>
        </div>
      )}

      {/* Export Action Controls */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-gray-800">Generate Standard Tally Format</h4>
          <p className="text-xs text-gray-500">Produce XML payloads ready for Tally Prime "Import Data"</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportDeliveryChallan}
            disabled={isExporting}
            className="px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-100 transition shadow-sm"
          >
            Export Delivery Challan XML
          </button>
          <button
            onClick={handleExportSampleInvoice}
            disabled={isExporting}
            className="px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition shadow-sm"
          >
            Export Sales Invoice XML (GST)
          </button>
        </div>
      </div>

      {/* Data Viewer Table */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Tabs & Search */}
          <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('ledgers')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === 'ledgers' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Ledgers ({data.ledgers.length})
              </button>
              <button
                onClick={() => setActiveTab('vouchers')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === 'vouchers' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Vouchers ({data.vouchers.length})
              </button>
              <button
                onClick={() => setActiveTab('units')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === 'units' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Units ({data.units.length})
              </button>
            </div>

            <div className="w-full md:w-64">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            {activeTab === 'ledgers' && (
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Ledger Name</th>
                    <th className="px-4 py-3">Group (Parent)</th>
                    <th className="px-4 py-3">GSTIN / PAN</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3 text-right">Opening Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLedgers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                        No ledgers found.
                      </td>
                    </tr>
                  ) : (
                    filteredLedgers.map((l: DecodedTallyLedger, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{l.name}</td>
                        <td className="px-4 py-3">{l.parent}</td>
                        <td className="px-4 py-3 text-xs">
                          {l.gstin ? <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{l.gstin}</span> : (l.pan || '-')}
                        </td>
                        <td className="px-4 py-3">{l.state || '-'}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {l.openingBalance > 0 ? (
                            <span>
                              ₹{l.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {l.balanceType}
                            </span>
                          ) : (
                            <span className="text-gray-400">0.00</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'vouchers' && (
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Vch Number</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Party Name</th>
                    <th className="px-4 py-3 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                        No vouchers found.
                      </td>
                    </tr>
                  ) : (
                    filteredVouchers.map((v: DecodedTallyVoucher, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">{v.voucherNumber}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 text-xs rounded bg-purple-50 text-purple-700 font-medium">
                            {v.voucherType}
                          </span>
                        </td>
                        <td className="px-4 py-3">{v.date}</td>
                        <td className="px-4 py-3">{v.partyName}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          ₹{v.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'units' && (
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Unit Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Decimal Places</th>
                    <th className="px-4 py-3">Reporting UQC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.units.map((u, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-gray-900">{u.name}</td>
                      <td className="px-4 py-3">{u.simpleUnit ? 'Simple Unit' : 'Compound'}</td>
                      <td className="px-4 py-3">{u.decimalPlaces}</td>
                      <td className="px-4 py-3 font-mono text-xs">{u.uqcName || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
