import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Clock, Edit, X, Plus, Filter, Calendar, Trash2 } from "lucide-react";

// API Configuration
const API_BASE_URL = "http://127.0.0.1:8000/api/vacancy";

// const debounce = (func, delay) => {
//   let timeoutId;
//   return function (...args) {
//     clearTimeout(timeoutId);
//     timeoutId = setTimeout(() => {
//       func.apply(this, args);
//     }, delay);
//   };
// };

const formatDateForAPI = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}-${month}-${year}`; // e.g., "27-09-2025"
};

// 2. Helper to format time for API
const formatTimeForAPI = (timeStr) => timeStr; // Assumes HH:MM format

// --- Default/Initial States ---
const initialShiftDetails = {
  start_time: "09:00",
  end_time: "17:00",
  type: "Consultation",
  price: 70,
};

const initialFormData = {
  title: "",
  description: "",
  shifts: [],
};

// Time options generation
const timeOptions = [];
for (let i = 0; i < 24; i++) {
  for (let j = 0; j < 60; j += 15) {
    const hour = i.toString().padStart(2, "0");
    const minute = j.toString().padStart(2, "0");
    timeOptions.push(`${hour}:${minute}`);
  }
}

// Allowed shift types
const shiftTypes = ["Consultation", "Telephone", "Ambulance", "Emergency"];

// --- Component ---
const ShiftManagement = () => {
  // rawVacancies stores the data directly from the API
  const [rawVacancies, setRawVacancies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState(null);

  // Filter States:
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [actualMinPrice, setActualMinPrice] = useState(0); // Debounced price for filtering logic
  const [actualMaxPrice, setActualMaxPrice] = useState(1000); // Debounced price for filtering logic

  const [formData, setFormData] = useState(initialFormData);
  const [dateInput, setDateInput] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [validationErrors, setValidationErrors] = useState({});

  // --- API & Data Handling ---

  const fetchVacancies = useCallback(async () => {
    setIsLoading(true);
    // NOTE: We no longer pass minP/maxP here to let the API return ALL data,
    // and then filter it client-side based on shifts/price range.
    let apiUrl = API_BASE_URL;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        // Store the raw (unfiltered) data
        setRawVacancies(result.data);
      } else {
        console.error(
          "API success: true, but data array is missing or malformed.",
          result
        );
        setRawVacancies([]);
      }
    } catch (error) {
      console.error("Failed to fetch vacancies:", error);
      setRawVacancies([]);
      alert(
        `Failed to connect to API: ${error.message}. Please ensure the backend is running at ${API_BASE_URL}`
      );
    } finally {
      setIsLoading(false);
    }
  }, []); // Only fetchVacancies on initial mount and after save/delete

  // 1. Initial Load (The price is NOT used to fetch, only to filter later)
  useEffect(() => {
    fetchVacancies();
  }, [fetchVacancies]);

  // 2. Price Filter DEBOUNCE EFFECT (Updates actualMinPrice/actualMaxPrice)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setActualMinPrice(minPrice);
      setActualMaxPrice(maxPrice);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(timeoutId);
    };
  }, [minPrice, maxPrice]);

  // 3. Client-Side Filtering (The core change)
  const filteredVacancies = useMemo(() => {
    // 1. Start with the raw data
    let filtered = rawVacancies;

    // 2. Apply the Price Range Filter logic
    if (actualMinPrice > 0 || actualMaxPrice < 1000) {
      // Filter the vacancies: MUST have at least one shift (swift)
      // whose price is within the actualMinPrice and actualMaxPrice range.
      filtered = filtered.filter((vacancy) => {
        // Check if swifts array exists and is not empty
        if (!vacancy.swifts || vacancy.swifts.length === 0) {
          return false; // Exclude vacancies with no shifts
        }

        // Check if ANY swift within the vacancy matches the price range
        const hasMatchingShift = vacancy.swifts.some((swift) => {
          return swift.price >= actualMinPrice && swift.price <= actualMaxPrice;
        });

        return hasMatchingShift;
      });
    } else {
      // If no filter is active (min=0, max=1000), still exclude vacancies
      // that have NO shifts, as per the required logic.
      filtered = filtered.filter(
        (vacancy) => vacancy.swifts && vacancy.swifts.length > 0
      );
    }

    return filtered;
  }, [rawVacancies, actualMinPrice, actualMaxPrice]);

  // --- Drawer & Form Logic (Unchanged) ---
  const openDrawer = (vacancy = null) => {
    setValidationErrors({});

    if (vacancy) {
      setEditingVacancy(vacancy);

      const loadedShifts = vacancy.swifts
        ? vacancy.swifts.map((swift) => ({
            date: swift.date,
            start_time: swift.start_time.substring(0, 5),
            end_time: swift.end_time.substring(0, 5),
            type: swift.type,
            price: swift.price,
          }))
        : [];

      setFormData({
        title: vacancy.title || "",
        description: vacancy.description || "",
        shifts: loadedShifts.sort((a, b) => a.date.localeCompare(b.date)),
      });
    } else {
      setEditingVacancy(null);
      setFormData(initialFormData);
    }
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingVacancy(null);
    setValidationErrors({});
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseInt(value, 10) : value,
    }));
  };

  // --- Multi-Shift Handlers (Unchanged) ---
  const addShift = () => {
    if (dateInput && !formData.shifts.some((s) => s.date === dateInput)) {
      const newShift = {
        date: dateInput, // YYYY-MM-DD format
        ...initialShiftDetails,
      };

      setFormData((prev) => ({
        ...prev,
        shifts: [...prev.shifts, newShift].sort((a, b) =>
          a.date.localeCompare(b.date)
        ),
      }));

      setDateInput("");
    }
  };

  const handleShiftChange = (index, name, value) => {
    setFormData((prev) => {
      const newShifts = [...prev.shifts];
      newShifts[index] = {
        ...newShifts[index],
        [name]: name === "price" ? parseInt(value, 10) : value,
      };
      return { ...prev, shifts: newShifts };
    });
  };

  const removeShift = (dateToRemove) => {
    setFormData((prev) => ({
      ...prev,
      shifts: prev.shifts.filter((s) => s.date !== dateToRemove),
    }));
  };

  // --- Validation (Unchanged) ---
  const validateForm = () => {
    const errors = {};
    if (!formData.title) errors.title = "Title is required.";
    if (!formData.description) errors.description = "Description is required.";
    if (formData.shifts.length === 0)
      errors.shifts = "At least one date/shift is required.";

    const shiftErrors = {};
    let hasShiftErrors = false;

    formData.shifts.forEach((shift, index) => {
      let isError = false;

      if (shift.price <= 0 || isNaN(shift.price)) {
        shiftErrors[`price-${index}`] = "Price must be > 0.";
        isError = true;
      }

      const startTimeInMinutes =
        parseInt(shift.start_time.split(":")[0]) * 60 +
        parseInt(shift.start_time.split(":")[1]);
      const endTimeInMinutes =
        parseInt(shift.end_time.split(":")[0]) * 60 +
        parseInt(shift.end_time.split(":")[1]);

      if (endTimeInMinutes <= startTimeInMinutes) {
        shiftErrors[`time-${index}`] = "End time must be after start time.";
        isError = true;
      }

      if (isError) hasShiftErrors = true;
    });

    if (hasShiftErrors) errors.shiftDetails = shiftErrors;

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // --- Save/Delete Handlers (fetchVacancies called without price filter) ---

  const handleSave = async () => {
    if (!validateForm()) {
      alert("Please fix the validation errors before saving.");
      return;
    }

    const shiftsPayload = formData.shifts.map((shift) => ({
      date: formatDateForAPI(shift.date),
      start_time: formatTimeForAPI(shift.start_time),
      end_time: formatTimeForAPI(shift.end_time),
      type: shift.type,
      price: shift.price,
    }));

    const vacancyPayload = {
      title: formData.title,
      description: formData.description,
      shifts: shiftsPayload,
    };

    try {
      let response;
      const url = editingVacancy
        ? `${API_BASE_URL}/${editingVacancy.id}`
        : API_BASE_URL;
      const method = editingVacancy ? "PUT" : "POST";

      response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vacancyPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to save vacancy: ${response.status} - ${errorText}`
        );
      }

      // Re-fetch ALL vacancies (no price filter here)
      await fetchVacancies();
      closeDrawer();
    } catch (error) {
      console.error("Error saving vacancy:", error);
      alert(
        `Error saving vacancy: ${error.message}. Please check the console for the full API response.`
      );
    }
  };

  const handleDelete = async () => {
    if (!editingVacancy) return;

    if (!window.confirm("Are you sure you want to delete this vacancy?")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/${editingVacancy.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to delete vacancy: ${response.status} - ${errorText}`
        );
      }

      // Re-fetch ALL vacancies (no price filter here)
      await fetchVacancies();
      closeDrawer();
    } catch (error) {
      console.error("Error deleting vacancy:", error);
      alert(
        `Error deleting vacancy: ${error.message}. Check console for details.`
      );
    }
  };

  // --- Render (Using filteredVacancies) ---

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Main Content */}
      <div className="flex-1 p-6">
        {/* Filter Section */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5" />
            <h2 className="text-lg font-semibold text-gray-800">
              Filter by Price Range
            </h2>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Price Range:{" "}
              <span className="font-bold text-gray-800">
                €{minPrice} - €{maxPrice}
              </span>
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="1000"
                value={minPrice}
                onChange={(e) =>
                  setMinPrice(Math.min(parseInt(e.target.value), maxPrice))
                }
                className="flex-1 accent-gray-700"
              />
              <input
                type="range"
                min="0"
                max="1000"
                value={maxPrice}
                onChange={(e) =>
                  setMaxPrice(Math.max(parseInt(e.target.value), minPrice))
                }
                className="flex-1 accent-gray-700"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Current Filter Applied: Shifts must have a price between €
              <span className="font-semibold text-gray-700">
                {actualMinPrice}
              </span>{" "}
              and €
              <span className="font-semibold text-gray-700">
                {actualMaxPrice}
              </span>{" "}
              (updates 500ms after input stops).
            </p>
          </div>
        </div>

        {/* Vacancies Section (Uses filteredVacancies) */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Vacancies</h2>
            <button
              onClick={() => openDrawer()}
              className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              ADD VACANCY
            </button>
          </div>

          {/* Vacancy List */}
          {isLoading ? (
            <p className="text-gray-500">Loading vacancies...</p>
          ) : filteredVacancies.length === 0 ? (
            <p className="text-gray-500">
              No vacancies found matching the current price filter or with no
              shifts.
            </p>
          ) : (
            filteredVacancies.map((vacancy) => (
              <div
                key={vacancy.id}
                className="mb-6 border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-800">
                    {vacancy.title} (ID: {vacancy.id})
                  </h3>
                  <button
                    onClick={() => openDrawer(vacancy)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
                <p className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                  {vacancy.description}
                </p>
                <div className="flex items-center space-x-2 text-sm">
                  <h1>
                    <p className="font-medium text-gray-600">Dates</p>
                  </h1>
                </div>

                <div className="mb-3">
                  <div className="space-y-2">
                    {/* Display the array of shifts (`swifts`) */}
                    {vacancy.swifts &&
                      vacancy.swifts.map((swift, index) => (
                        <div
                          key={index}
                          className="bg-gray-700 text-white p-3 rounded-md flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4 text-sm">
                            <span className="min-w-24 font-bold">
                              {swift.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {swift.start_time.substring(0, 5)} -{" "}
                              {swift.end_time.substring(0, 5)}
                            </span>
                            <span className="bg-gray-600 px-2 py-1 rounded text-xs">
                              {swift.type}
                            </span>
                          </div>
                          <span className="font-semibold">€{swift.price}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- Drawer (Unchanged) --- */}
      {isDrawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={closeDrawer}
          />
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-800">
                  {editingVacancy ? "Edit Vacancy" : "Create Vacancy"}
                </h2>
                <button
                  onClick={closeDrawer}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title and Description remain the same */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${
                      validationErrors.title
                        ? "border-red-500"
                        : "border-gray-300"
                    } rounded-md focus:outline-none focus:ring-2 focus:ring-gray-700`}
                    placeholder="Shift Title"
                  />
                  {validationErrors.title && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.title}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className={`w-full px-3 py-2 border ${
                      validationErrors.description
                        ? "border-red-500"
                        : "border-gray-300"
                    } rounded-md focus:outline-none focus:ring-2 focus:ring-gray-700`}
                    placeholder="Shift Description"
                  />
                  {validationErrors.description && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.description}
                    </p>
                  )}
                </div>
                {/* --- Multi-Date Input (Add Shift) --- */}
                <div className="border p-4 rounded-md border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Add Date for a New Shift{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="date"
                      value={dateInput}
                      onChange={(e) => setDateInput(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-700"
                    />
                    <button
                      type="button"
                      onClick={addShift}
                      disabled={
                        !dateInput ||
                        formData.shifts.some((s) => s.date === dateInput)
                      }
                      className="bg-gray-700 text-white p-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
                      title="Add Date and Default Shift"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {validationErrors.shifts && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.shifts}
                    </p>
                  )}
                </div>

                {/* --- Individual Shift Details (Scrollable Section) --- */}
                <div className="space-y-4 max-h-64 overflow-y-auto p-1">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Individual Shift Settings
                  </h3>
                  {formData.shifts.length === 0 ? (
                    <p className="text-gray-400 text-sm">
                      Use the date picker above to add shifts.
                    </p>
                  ) : (
                    formData.shifts.map((shift, index) => (
                      <div
                        key={shift.date}
                        className={`border ${
                          validationErrors.shiftDetails &&
                          (validationErrors.shiftDetails[`time-${index}`] ||
                            validationErrors.shiftDetails[`price-${index}`])
                            ? "border-red-500 bg-red-50"
                            : "border-gray-200"
                        } rounded-md p-4 space-y-3`}
                      >
                        <div className="flex justify-between items-start border-b pb-2 mb-2">
                          <span className="font-bold text-gray-700">
                            Shift for: {formatDateForAPI(shift.date)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeShift(shift.date)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Time Validation Error */}
                        {validationErrors.shiftDetails &&
                          validationErrors.shiftDetails[`time-${index}`] && (
                            <p className="text-red-500 text-xs mb-2">
                              {validationErrors.shiftDetails[`time-${index}`]}
                            </p>
                          )}

                        <div className="grid grid-cols-2 gap-3">
                          {/* Start Time */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Start Time
                            </label>
                            <select
                              name="start_time"
                              value={shift.start_time}
                              onChange={(e) =>
                                handleShiftChange(
                                  index,
                                  e.target.name,
                                  e.target.value
                                )
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-700"
                            >
                              {timeOptions.map((time) => (
                                <option key={time} value={time}>
                                  {time}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* End Time */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              End Time
                            </label>
                            <select
                              name="end_time"
                              value={shift.end_time}
                              onChange={(e) =>
                                handleShiftChange(
                                  index,
                                  e.target.name,
                                  e.target.value
                                )
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-700"
                            >
                              {timeOptions.map((time) => (
                                <option key={time} value={time}>
                                  {time}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Price */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Price <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center">
                              <span className="text-sm text-gray-500 mr-1">
                                €
                              </span>
                              <input
                                type="number"
                                name="price"
                                value={shift.price}
                                onChange={(e) =>
                                  handleShiftChange(
                                    index,
                                    e.target.name,
                                    e.target.value
                                  )
                                }
                                className={`w-full px-2 py-1 text-sm border ${
                                  validationErrors.shiftDetails &&
                                  validationErrors.shiftDetails[
                                    `price-${index}`
                                  ]
                                    ? "border-red-500"
                                    : "border-gray-300"
                                } rounded focus:outline-none focus:ring-1 focus:ring-gray-700`}
                              />
                            </div>
                            {validationErrors.shiftDetails &&
                              validationErrors.shiftDetails[
                                `price-${index}`
                              ] && (
                                <p className="text-red-500 text-xs mt-1">
                                  {
                                    validationErrors.shiftDetails[
                                      `price-${index}`
                                    ]
                                  }
                                </p>
                              )}
                          </div>

                          {/* Type */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Type
                            </label>
                            <select
                              name="type"
                              value={shift.type}
                              onChange={(e) =>
                                handleShiftChange(
                                  index,
                                  e.target.name,
                                  e.target.value
                                )
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-700"
                            >
                              {shiftTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
                {editingVacancy && (
                  <button
                    onClick={handleDelete}
                    className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-300"
                  >
                    DELETE
                  </button>
                )}
                <button
                  onClick={handleSave}
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800"
                >
                  SAVE
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ShiftManagement;
